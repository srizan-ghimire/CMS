import { Injectable, Logger } from "@nestjs/common";
import { MediaType, SocialPlatform } from "@prisma/client";
import { validateAgainstPlatform } from "@social-platform/shared";
import { StorageService } from "../../../media/lib/storage.service";
import {
  PublishError,
  type PublishContext,
  type PublishOutcome,
  type PublishProvider,
  type PublishRequest,
} from "../interfaces/publish-provider.interface";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

interface CreatorInfo {
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

/**
 * TikTok Content Posting API.
 *
 * Uses `FILE_UPLOAD` rather than `PULL_FROM_URL` deliberately: PULL_FROM_URL requires a verified,
 * domain-owned URL, which would make local development impossible. Pushing the bytes ourselves
 * means this is the one provider that works without a publicly reachable media host.
 *
 * `creator_info/query` must be called before *every* publish — TikTok rejects posts that violate
 * the creator's current privacy/interaction settings, and those settings can change at any time.
 */
@Injectable()
export class TikTokPublisher implements PublishProvider {
  private readonly logger = new Logger(TikTokPublisher.name);
  readonly platform = SocialPlatform.TIKTOK;
  /** We upload the bytes, so no public URL is needed. */
  readonly requiresPublicMediaUrls = false;

  constructor(private readonly storage: StorageService) {}

  validate(request: PublishRequest): { ok: boolean; errors: string[] } {
    const errors = validateAgainstPlatform(
      SocialPlatform.TIKTOK,
      request.content,
      request.media.map((m) => ({
        type: m.type,
        sizeBytes: m.sizeBytes,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
      })),
    );
    if (request.media.length === 0) {
      errors.push("TikTok requires a video or photo.");
    }
    if (request.firstComment) {
      errors.push("TikTok does not support publishing a first comment.");
    }
    return { ok: errors.length === 0, errors };
  }

  async publish(request: PublishRequest, ctx: PublishContext): Promise<PublishOutcome> {
    const token = request.account.accessToken;

    if (request.target.containerId) {
      return this.checkStatus(request, request.target.containerId);
    }

    const creator = await this.creatorInfo(token);

    const requested = (request.options["privacy_level"] as string | undefined) ?? undefined;
    // Honour the creator's *current* options rather than what was chosen when the post was
    // composed — an unaudited app is forced to SELF_ONLY, and settings change independently.
    const privacyLevel =
      requested && creator.privacy_level_options.includes(requested)
        ? requested
        : creator.privacy_level_options[0];
    if (!privacyLevel) {
      throw new PublishError("TikTok returned no permitted privacy levels for this creator.", false);
    }

    const video = request.media.find((m) => m.type === MediaType.VIDEO);
    if (video?.durationMs && video.durationMs / 1000 > creator.max_video_post_duration_sec) {
      throw new PublishError(
        `Video is longer than this creator's ${creator.max_video_post_duration_sec}s limit.`,
        false,
        "DURATION",
      );
    }

    const isPhotoPost = !video;
    const initUrl = isPhotoPost
      ? `${TIKTOK_API}/post/publish/content/init/`
      : `${TIKTOK_API}/post/publish/video/init/`;

    const postInfo: Record<string, unknown> = {
      title: request.content.slice(0, 2200),
      privacy_level: privacyLevel,
      disable_comment: creator.comment_disabled || request.options["disable_comment"] === true,
      disable_duet: creator.duet_disabled || request.options["disable_duet"] === true,
      disable_stitch: creator.stitch_disabled || request.options["disable_stitch"] === true,
    };

    const body = isPhotoPost
      ? {
          post_info: { ...postInfo, description: request.content.slice(0, 2200) },
          source_info: {
            source: "PULL_FROM_URL",
            photo_images: request.media.map((m) => m.publicUrl),
          },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        }
      : {
          post_info: postInfo,
          source_info: {
            source: "FILE_UPLOAD",
            video_size: video!.sizeBytes,
            chunk_size: video!.sizeBytes,
            total_chunk_count: 1,
          },
        };

    const init = await this.call<{ data: { publish_id: string; upload_url?: string } }>(
      initUrl,
      token,
      body,
    );
    const publishId = init.data.publish_id;

    // Persist before uploading: a retry then resumes rather than re-initialising a second post.
    await ctx.saveContainerId(publishId);

    if (!isPhotoPost && init.data.upload_url) {
      const bytes = await this.storage.getObject(video!.storageKey);
      const upload = await fetch(init.data.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": video!.mimeType,
          "Content-Length": String(bytes.length),
          "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}`,
        },
        body: bytes,
      });
      if (!upload.ok) {
        throw new PublishError(
          `TikTok upload failed (${upload.status})`,
          upload.status >= 500,
          String(upload.status),
        );
      }
    }

    // TikTok processes asynchronously; poll rather than block.
    return { kind: "PENDING", containerId: publishId, recheckAfterMs: 5_000 };
  }

  async checkStatus(request: PublishRequest, containerId: string): Promise<PublishOutcome> {
    const result = await this.call<{
      data: { status: string; publicaly_available_post_id?: string[]; fail_reason?: string };
    }>(`${TIKTOK_API}/post/publish/status/fetch/`, request.account.accessToken, {
      publish_id: containerId,
    });

    const status = result.data.status;
    if (status === "PUBLISH_COMPLETE") {
      const postId = result.data.publicaly_available_post_id?.[0] ?? containerId;
      return {
        kind: "PUBLISHED",
        platformPostId: postId,
        permalink: `https://www.tiktok.com/@${request.account.metadata?.["username"] ?? ""}/video/${postId}`,
        publishedAt: new Date(),
      };
    }
    if (status === "FAILED") {
      throw new PublishError(
        `TikTok publish failed: ${result.data.fail_reason ?? "unknown reason"}`,
        false,
        result.data.fail_reason,
      );
    }
    return { kind: "PENDING", containerId, recheckAfterMs: 5_000 };
  }

  private async creatorInfo(token: string): Promise<CreatorInfo> {
    const result = await this.call<{ data: CreatorInfo }>(
      `${TIKTOK_API}/post/publish/creator_info/query/`,
      token,
      {},
    );
    return result.data;
  }

  private async call<T>(url: string, token: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    } & T;

    const code = json.error?.code;
    if (!response.ok || (code && code !== "ok")) {
      const tokenInvalid = code === "access_token_invalid" || response.status === 401;
      const retryable = response.status >= 500 || code === "rate_limit_exceeded";
      throw new PublishError(
        json.error?.message ?? `TikTok API error (${response.status})`,
        retryable && !tokenInvalid,
        code,
        tokenInvalid,
      );
    }
    return json as T;
  }
}

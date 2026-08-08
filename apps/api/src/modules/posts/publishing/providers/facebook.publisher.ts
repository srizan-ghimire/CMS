import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MediaType, SocialPlatform } from "@prisma/client";
import { validateAgainstPlatform } from "@social-platform/shared";
import {
  PublishError,
  type PublishContext,
  type PublishOutcome,
  type PublishProvider,
  type PublishRequest,
} from "../interfaces/publish-provider.interface";

/**
 * Publishes to a Facebook Page using the Page access token stored at connect time.
 *
 * Text/link posts go to /feed. A single photo goes to /photos. An album is N unpublished /photos
 * uploads collected into one /feed post via attached_media — Facebook has no single-call album
 * endpoint. Video goes to /videos.
 */
@Injectable()
export class FacebookPublisher implements PublishProvider {
  private readonly logger = new Logger(FacebookPublisher.name);
  readonly platform = SocialPlatform.FACEBOOK;
  /** Meta's servers fetch the media URL themselves, so it must be internet-reachable. */
  readonly requiresPublicMediaUrls = true;

  private readonly graphBase: string;

  constructor(private readonly config: ConfigService) {
    const version = this.config.get<string>("social.facebook.graphVersion") ?? "v23.0";
    this.graphBase = `https://graph.facebook.com/${version}`;
  }

  validate(request: PublishRequest): { ok: boolean; errors: string[] } {
    const errors = validateAgainstPlatform(
      SocialPlatform.FACEBOOK,
      request.content,
      request.media.map((m) => ({
        type: m.type,
        sizeBytes: m.sizeBytes,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
      })),
    );
    if (request.media.some((m) => !m.publicUrl)) {
      errors.push(
        "Facebook downloads media from a public URL — set MEDIA_PUBLIC_BASE_URL to an internet-reachable host.",
      );
    }
    return { ok: errors.length === 0, errors };
  }

  async publish(request: PublishRequest, ctx: PublishContext): Promise<PublishOutcome> {
    const pageId = request.account.externalAccountId;
    const token = request.account.accessToken;
    const images = request.media.filter((m) => m.type === MediaType.IMAGE);
    const videos = request.media.filter((m) => m.type === MediaType.VIDEO);

    let postId: string;

    if (videos.length > 0) {
      const video = videos[0]!;
      const result = await this.call<{ id: string }>(`${this.graphBase}/${pageId}/videos`, {
        file_url: video.publicUrl,
        description: request.content,
        access_token: token,
      });
      postId = result.id;
    } else if (images.length === 1) {
      const result = await this.call<{ post_id?: string; id: string }>(
        `${this.graphBase}/${pageId}/photos`,
        { url: images[0]!.publicUrl, caption: request.content, access_token: token },
      );
      postId = result.post_id ?? result.id;
    } else if (images.length > 1) {
      // Upload each photo unpublished, then attach them all to one feed post.
      const mediaFbids: string[] = [];
      for (const image of images) {
        const uploaded = await this.call<{ id: string }>(`${this.graphBase}/${pageId}/photos`, {
          url: image.publicUrl,
          published: "false",
          access_token: token,
        });
        mediaFbids.push(uploaded.id);
      }
      // Persist before the finalizing call so a retry doesn't re-upload every photo.
      await ctx.saveContainerId(mediaFbids.join(","));

      const payload: Record<string, string> = { message: request.content, access_token: token };
      mediaFbids.forEach((id, index) => {
        payload[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
      });
      const result = await this.call<{ id: string }>(`${this.graphBase}/${pageId}/feed`, payload);
      postId = result.id;
    } else {
      const result = await this.call<{ id: string }>(`${this.graphBase}/${pageId}/feed`, {
        message: request.content,
        access_token: token,
      });
      postId = result.id;
    }

    if (request.firstComment) {
      try {
        await this.call(`${this.graphBase}/${postId}/comments`, {
          message: request.firstComment,
          access_token: token,
        });
      } catch (err) {
        // The post is already live; a failed first comment must not fail the publish.
        this.logger.warn(`First comment failed for ${postId}: ${String(err)}`);
      }
    }

    return {
      kind: "PUBLISHED",
      platformPostId: postId,
      permalink: `https://www.facebook.com/${postId}`,
      publishedAt: new Date(),
    };
  }

  private async call<T>(url: string, params: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });

    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; type?: string; is_transient?: boolean };
    } & T;

    if (!response.ok || body.error) {
      const error = body.error ?? {};
      const code = error.code ? String(error.code) : String(response.status);
      // 190 = invalid/expired token. 4/17/32/613 are rate limits, which are worth retrying.
      const tokenInvalid = error.code === 190 || error.type === "OAuthException";
      const retryable =
        Boolean(error.is_transient) || [4, 17, 32, 613].includes(error.code ?? 0) || response.status >= 500;

      // Deliberately does not include the request params — they carry the access token.
      throw new PublishError(
        error.message ?? `Facebook API error (${response.status})`,
        retryable && !tokenInvalid,
        code,
        tokenInvalid,
      );
    }

    return body as T;
  }
}

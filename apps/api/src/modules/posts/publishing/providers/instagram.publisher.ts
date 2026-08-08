import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MediaType, SocialPlatform } from "@prisma/client";
import { PLATFORM_LIMITS, validateAgainstPlatform } from "@social-platform/shared";
import {
  PublishError,
  type PublishContext,
  type PublishOutcome,
  type PublishProvider,
  type PublishRequest,
} from "../interfaces/publish-provider.interface";

/**
 * Instagram publishing is two-phase: create a media container, then publish it by id.
 *
 * The access token is the *parent Facebook Page's* token, already stored on the Instagram
 * SocialAccount row at connect time (see FacebookProvider.handleCallback, which also records
 * metadata.linkedFacebookPageId) — Instagram has no token of its own.
 *
 * Video and Reels containers are processed asynchronously, so this returns PENDING and lets the
 * processor poll rather than holding a worker open for the length of a transcode.
 */
@Injectable()
export class InstagramPublisher implements PublishProvider {
  private readonly logger = new Logger(InstagramPublisher.name);
  readonly platform = SocialPlatform.INSTAGRAM;
  readonly requiresPublicMediaUrls = true;

  private readonly graphBase: string;

  constructor(private readonly config: ConfigService) {
    const version = this.config.get<string>("social.facebook.graphVersion") ?? "v23.0";
    this.graphBase = `https://graph.facebook.com/${version}`;
  }

  validate(request: PublishRequest): { ok: boolean; errors: string[] } {
    const errors = validateAgainstPlatform(
      SocialPlatform.INSTAGRAM,
      request.content,
      request.media.map((m) => ({
        type: m.type,
        sizeBytes: m.sizeBytes,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
      })),
    );

    // Instagram's rules are unusually strict, and each one is a "why did my post fail" ticket if
    // it surfaces from a queue job instead of the composer.
    if (request.media.length === 0) {
      errors.push("Instagram requires at least one image or video.");
    }
    if (request.media.length > PLATFORM_LIMITS.INSTAGRAM.maxImages) {
      errors.push(`Instagram carousels hold at most ${PLATFORM_LIMITS.INSTAGRAM.maxImages} items.`);
    }
    if (request.media.some((m) => !m.publicUrl)) {
      errors.push(
        "Instagram downloads media from a public URL — set MEDIA_PUBLIC_BASE_URL to an internet-reachable host.",
      );
    }
    return { ok: errors.length === 0, errors };
  }

  async publish(request: PublishRequest, ctx: PublishContext): Promise<PublishOutcome> {
    const igUserId = request.account.externalAccountId;
    const token = request.account.accessToken;
    const mediaType = (request.options["media_type"] as string | undefined) ?? undefined;

    // Resume an async container from a previous attempt rather than creating a second one.
    if (request.target.containerId) {
      return this.checkStatus(request, request.target.containerId);
    }

    await this.assertWithinPublishingLimit(igUserId, token);

    let creationId: string;

    if (request.media.length > 1) {
      // Carousel: one container per item, then a parent container holding them all.
      const childIds: string[] = [];
      for (const item of request.media) {
        const child = await this.call<{ id: string }>(`${this.graphBase}/${igUserId}/media`, {
          ...(item.type === MediaType.VIDEO
            ? { video_url: item.publicUrl, media_type: "VIDEO" }
            : { image_url: item.publicUrl }),
          is_carousel_item: "true",
          access_token: token,
        });
        childIds.push(child.id);
      }
      const parent = await this.call<{ id: string }>(`${this.graphBase}/${igUserId}/media`, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: request.content,
        access_token: token,
      });
      creationId = parent.id;
    } else {
      const item = request.media[0]!;
      const isVideo = item.type === MediaType.VIDEO;
      const container = await this.call<{ id: string }>(`${this.graphBase}/${igUserId}/media`, {
        ...(isVideo
          ? { video_url: item.publicUrl, media_type: mediaType ?? "REELS" }
          : { image_url: item.publicUrl }),
        caption: request.content,
        ...(item.altText ? { alt_text: item.altText } : {}),
        ...(request.options["location_id"]
          ? { location_id: String(request.options["location_id"]) }
          : {}),
        access_token: token,
      });
      creationId = container.id;
    }

    // Persist before publishing so a lost response resumes instead of double-posting.
    await ctx.saveContainerId(creationId);

    const status = await this.containerStatus(creationId, token);
    if (status !== "FINISHED") {
      // Video containers take seconds to minutes; hand control back to the queue.
      return { kind: "PENDING", containerId: creationId, recheckAfterMs: 5_000 };
    }

    return this.finalize(request, creationId);
  }

  async checkStatus(request: PublishRequest, containerId: string): Promise<PublishOutcome> {
    const token = request.account.accessToken;
    const status = await this.containerStatus(containerId, token);

    if (status === "ERROR" || status === "EXPIRED") {
      throw new PublishError(`Instagram container ${status.toLowerCase()}`, false, status);
    }
    if (status !== "FINISHED") {
      return { kind: "PENDING", containerId, recheckAfterMs: 5_000 };
    }
    return this.finalize(request, containerId);
  }

  private async finalize(request: PublishRequest, creationId: string): Promise<PublishOutcome> {
    const igUserId = request.account.externalAccountId;
    const token = request.account.accessToken;

    const published = await this.call<{ id: string }>(`${this.graphBase}/${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });

    if (request.firstComment) {
      try {
        await this.call(`${this.graphBase}/${published.id}/comments`, {
          message: request.firstComment,
          access_token: token,
        });
      } catch (err) {
        this.logger.warn(`First comment failed for ${published.id}: ${String(err)}`);
      }
    }

    let permalink: string | undefined;
    try {
      const meta = await this.get<{ permalink?: string }>(
        `${this.graphBase}/${published.id}?fields=permalink&access_token=${encodeURIComponent(token)}`,
      );
      permalink = meta.permalink;
    } catch {
      // Permalink is cosmetic — never fail an already-successful publish over it.
    }

    return { kind: "PUBLISHED", platformPostId: published.id, permalink, publishedAt: new Date() };
  }

  private async containerStatus(containerId: string, token: string): Promise<string> {
    const result = await this.get<{ status_code?: string }>(
      `${this.graphBase}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    return result.status_code ?? "IN_PROGRESS";
  }

  /** Instagram allows 25 published posts per rolling 24h per account. */
  private async assertWithinPublishingLimit(igUserId: string, token: string): Promise<void> {
    try {
      const result = await this.get<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>(
        `${this.graphBase}/${igUserId}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token)}`,
      );
      const row = result.data?.[0];
      const used = row?.quota_usage ?? 0;
      const total = row?.config?.quota_total ?? 25;
      if (used >= total) {
        // Retryable: the rolling window will free up on its own.
        throw new PublishError(
          `Instagram publishing limit reached (${used}/${total} in the last 24 hours).`,
          true,
          "RATE_LIMIT",
        );
      }
    } catch (err) {
      if (err instanceof PublishError) throw err;
      // The limit endpoint is advisory; don't block a publish because it was unavailable.
      this.logger.warn(`Could not read Instagram publishing limit: ${String(err)}`);
    }
  }

  private async call<T>(url: string, params: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    return this.handle<T>(response);
  }

  private async get<T>(url: string): Promise<T> {
    return this.handle<T>(await fetch(url));
  }

  private async handle<T>(response: Response): Promise<T> {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; type?: string; is_transient?: boolean };
    } & T;

    if (!response.ok || body.error) {
      const error = body.error ?? {};
      const tokenInvalid = error.code === 190 || error.type === "OAuthException";
      const retryable =
        Boolean(error.is_transient) || [4, 17, 32, 613].includes(error.code ?? 0) || response.status >= 500;
      throw new PublishError(
        error.message ?? `Instagram API error (${response.status})`,
        retryable && !tokenInvalid,
        error.code ? String(error.code) : String(response.status),
        tokenInvalid,
      );
    }
    return body as T;
  }
}

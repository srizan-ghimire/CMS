import { Injectable, Logger } from "@nestjs/common";
import { SocialPlatform } from "@prisma/client";
import { PLATFORM_LIMITS, validateAgainstPlatform } from "@social-platform/shared";
import {
  PublishError,
  type PublishContext,
  type PublishOutcome,
  type PublishProvider,
  type PublishRequest,
} from "../interfaces/publish-provider.interface";

/**
 * A publisher that goes nowhere.
 *
 * Selected whenever `MEDIA_PUBLIC_BASE_URL` is unset, which is the normal local-dev state. It
 * exists because the real Facebook and Instagram providers publish by handing Meta a URL that
 * *Meta's servers* fetch — and `http://localhost:9000` is unreachable from Meta's infrastructure.
 * Without this, nothing in the publish pipeline, the scheduler or the calendar could be run or
 * demonstrated locally, and none of it could ship before Meta App Review completes.
 *
 * It deliberately exercises the same code paths as a real provider: it validates, it can return
 * PENDING to make the processor poll, and it can be told to fail — so the state machine, the
 * retry/backoff behaviour and the partial-publish reconciliation are all genuinely tested.
 */
@Injectable()
export class StubPublisher implements PublishProvider {
  private readonly logger = new Logger(StubPublisher.name);

  readonly platform: SocialPlatform;
  readonly requiresPublicMediaUrls = false;

  /** 0..1 — set via `platformOptions.__stubFailureRate` on a target to exercise retry paths. */
  constructor(platform: SocialPlatform) {
    this.platform = platform;
  }

  validate(request: PublishRequest): { ok: boolean; errors: string[] } {
    const errors = validateAgainstPlatform(
      this.platform,
      request.content,
      request.media.map((m) => ({
        type: m.type,
        sizeBytes: m.sizeBytes,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
      })),
    );

    // Mirror Instagram's carousel rule so the stub isn't more permissive than the real thing.
    if (this.platform === SocialPlatform.INSTAGRAM) {
      const images = request.media.length;
      if (images > PLATFORM_LIMITS.INSTAGRAM.maxImages) {
        errors.push(`Instagram: carousels hold at most ${PLATFORM_LIMITS.INSTAGRAM.maxImages} items.`);
      }
    }

    return { ok: errors.length === 0, errors };
  }

  async publish(request: PublishRequest, ctx: PublishContext): Promise<PublishOutcome> {
    const options = request.options as {
      __stubFailureRate?: number;
      __stubFailTerminally?: boolean;
      __stubPending?: boolean;
    };

    // Simulate an async platform: first call parks a container, the poll completes it.
    if (options.__stubPending && !request.target.containerId) {
      const containerId = `stub-container-${request.target.idempotencyKey}`;
      await ctx.saveContainerId(containerId);
      return { kind: "PENDING", containerId, recheckAfterMs: 1000 };
    }

    if (options.__stubFailTerminally) {
      throw new PublishError("Stub: permanent failure", false, "STUB_TERMINAL");
    }

    const failureRate = options.__stubFailureRate ?? 0;
    if (failureRate > 0 && Math.random() < failureRate) {
      throw new PublishError("Stub: transient upstream error", true, "STUB_TRANSIENT");
    }

    // A little latency so progress is observable in the UI rather than instant.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const platformPostId = `stub-${this.platform.toLowerCase()}-${request.target.idempotencyKey}`;
    this.logger.log(
      `[stub] "published" to ${this.platform} for account ${request.account.externalAccountId} (${request.media.length} media)`,
    );

    return {
      kind: "PUBLISHED",
      platformPostId,
      permalink: `https://example.invalid/${this.platform.toLowerCase()}/${platformPostId}`,
      publishedAt: new Date(),
    };
  }

  async checkStatus(request: PublishRequest, containerId: string): Promise<PublishOutcome> {
    const platformPostId = `stub-${this.platform.toLowerCase()}-${request.target.idempotencyKey}`;
    return {
      kind: "PUBLISHED",
      platformPostId,
      permalink: `https://example.invalid/${this.platform.toLowerCase()}/${containerId}`,
      publishedAt: new Date(),
    };
  }
}

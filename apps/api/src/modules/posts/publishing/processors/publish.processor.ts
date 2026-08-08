import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SocialPlatform } from "@prisma/client";
import { PublishError } from "../interfaces/publish-provider.interface";
import { PublishingService } from "../publishing.service";

import { PUBLISH_JOB, PUBLISH_QUEUE, type PublishJobData } from "../publishing.constants";

export { PUBLISH_JOB, PUBLISH_QUEUE };
export type { PublishJobData };

/**
 * One job per PostTarget. Structure mirrors TokenRefreshProcessor.
 *
 * The ordering here is the whole point: claim with a guarded write first, fetch credentials
 * second (never from the snapshot), and let a PENDING outcome re-queue without consuming an
 * attempt so a slow platform transcode isn't mistaken for a failure.
 */
@Processor(PUBLISH_QUEUE)
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(private readonly publishing: PublishingService) {
    super();
  }

  async process(job: Job<PublishJobData>): Promise<{ status: string }> {
    if (job.name !== PUBLISH_JOB) return { status: "ignored" };
    const { targetId } = job.data;

    // 1. Claim. A count of 0 means another worker (or a cancel) already owns this target.
    const claimed = await this.publishing.claimTarget(targetId);
    if (!claimed) {
      this.logger.debug(`Target ${targetId} was not claimable; skipping.`);
      return { status: "not-claimable" };
    }

    let request;
    try {
      // 2. Build the request and fetch a live token.
      request = await this.publishing.buildRequestForTarget(targetId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.publishing.markFailed(targetId, message, "CREDENTIALS");
      return { status: "failed" };
    }

    const provider = this.publishing.providerFor(request.account.platform as SocialPlatform);
    if (!provider) {
      await this.publishing.markFailed(
        targetId,
        `${request.account.platform} publishing is not supported.`,
        "UNSUPPORTED",
      );
      return { status: "failed" };
    }

    if (provider.requiresPublicMediaUrls && request.media.some((m) => !m.publicUrl)) {
      // Terminal and explicit: retrying cannot make localhost reachable from a platform's servers.
      await this.publishing.markFailed(
        targetId,
        `${request.account.platform} fetches media by URL, but MEDIA_PUBLIC_BASE_URL is not configured.`,
        "NO_PUBLIC_MEDIA",
      );
      return { status: "failed" };
    }

    try {
      const outcome = request.target.containerId && provider.checkStatus
        ? await provider.checkStatus(request, request.target.containerId)
        : await provider.publish(request, {
            saveContainerId: (containerId) => this.publishing.saveContainerId(targetId, containerId),
          });

      if (outcome.kind === "PUBLISHED") {
        await this.publishing.markPublished(
          targetId,
          outcome.platformPostId,
          outcome.permalink,
          outcome.publishedAt,
        );
        return { status: "published" };
      }

      // PENDING: the platform is still processing. Re-queue with a delay and give the attempt
      // back, so a long transcode never exhausts the retry budget.
      await this.publishing.markAwaitingPlatform(
        targetId,
        request.target.idempotencyKey,
        outcome.recheckAfterMs,
      );
      return { status: "pending" };
    } catch (err) {
      return this.handleFailure(job, targetId, request.account.platform, err);
    }
  }

  private async handleFailure(
    job: Job<PublishJobData>,
    targetId: string,
    platform: SocialPlatform,
    err: unknown,
  ): Promise<{ status: string }> {
    const publishError = err instanceof PublishError ? err : null;
    // Never interpolate the request into the message — it carries a decrypted access token.
    const message = err instanceof Error ? err.message : String(err);

    if (publishError?.tokenInvalid) {
      const accountId = await this.publishing.socialAccountIdForTarget(targetId);
      if (accountId) {
        await this.publishing.handleInvalidToken(targetId, accountId, message);
      } else {
        await this.publishing.markFailed(targetId, message, publishError.code);
      }
      return { status: "failed-token" };
    }

    const retryable = publishError ? publishError.retryable : true;
    const attemptsMade = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;

    if (!retryable) {
      await this.publishing.markFailed(targetId, message, publishError?.code);
      // Stop BullMQ retrying something that cannot succeed.
      await job.discard();
      return { status: "failed-terminal" };
    }

    if (attemptsMade >= maxAttempts) {
      await this.publishing.markFailed(targetId, message, publishError?.code);
      return { status: "failed-exhausted" };
    }

    // Mirror BullMQ's exponential backoff so nextAttemptAt shown in the UI matches reality.
    const delay = 30_000 * 2 ** (attemptsMade - 1);
    await this.publishing.markRetrying(targetId, message, publishError?.code, delay);
    this.logger.warn(`Publish to ${platform} failed (attempt ${attemptsMade}/${maxAttempts}): ${message}`);
    // Rethrow so BullMQ owns the backoff schedule.
    throw err;
  }
}

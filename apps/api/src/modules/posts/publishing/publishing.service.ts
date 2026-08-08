import { ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  MediaType,
  NotificationType,
  PostStatus,
  PostTargetStatus,
  Prisma,
  SocialPlatform,
} from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { WorkspacesService } from "../../workspaces/workspaces.service";
import { PUBLISH_ROLES } from "../../workspaces/lib/roles";
import { SocialAccountsService } from "../../social-accounts/social-accounts.service";
import { resolveContent } from "../lib/content-serializer";
import {
  PUBLISH_PROVIDERS,
  type PublishProviderRegistry,
} from "./providers/publish-provider.registry";
import type { PublishMedia, PublishRequest } from "./interfaces/publish-provider.interface";
import { PUBLISH_JOB, PUBLISH_QUEUE } from "./publishing.constants";
import { AuditService } from "../../../common/audit/audit.service";

/** Terminal target states — nothing further happens without explicit user action. */
const TERMINAL: PostTargetStatus[] = [
  PostTargetStatus.PUBLISHED,
  PostTargetStatus.FAILED,
  PostTargetStatus.CANCELLED,
  PostTargetStatus.SKIPPED,
];

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);
  private readonly mediaPublicBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly socialAccounts: SocialAccountsService,
    private readonly config: ConfigService,
    @Inject(PUBLISH_PROVIDERS) private readonly providers: PublishProviderRegistry,
    @InjectQueue(PUBLISH_QUEUE) private readonly queue: Queue,
    private readonly audit: AuditService,
  ) {
    this.mediaPublicBase = (this.config.get<string>("media.publicBaseUrl") ?? "").replace(/\/$/, "");
  }

  /* --------------------------------- Enqueue -------------------------------- */

  /**
   * Validates every target, freezes what will be published, and enqueues one job per target.
   *
   * Validation happens here rather than in the worker so a platform-rule violation becomes
   * SKIPPED without ever burning a retry attempt or looking like an outage.
   */
  async enqueue(
    postId: string,
    userId: string,
    options: { publishNow?: boolean } = {},
  ): Promise<{ queued: number; skipped: number }> {
    const post = await this.loadForPublish(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, PUBLISH_ROLES);

    if (post.status === PostStatus.PUBLISHING) {
      throw new ConflictException("This post is already publishing.");
    }
    if (post.status === PostStatus.PENDING_APPROVAL) {
      throw new ConflictException("This post is still awaiting approval.");
    }
    if (post.targets.length === 0) {
      throw new ConflictException("Add at least one account before publishing.");
    }

    const runAt = options.publishNow ? new Date() : (post.scheduledAt ?? new Date());

    let queued = 0;
    let skipped = 0;

    for (const target of post.targets) {
      if (TERMINAL.includes(target.status) && target.status !== PostTargetStatus.SKIPPED) {
        continue;
      }

      const request = await this.buildRequest(post, target);
      const provider = this.providers[target.socialAccount.platform as SocialPlatform];

      if (!provider) {
        await this.markSkipped(target.id, `${target.socialAccount.platform} publishing is not supported yet.`);
        skipped++;
        continue;
      }

      const validation = provider.validate(request);
      if (!validation.ok) {
        await this.markSkipped(target.id, validation.errors.join(" "));
        skipped++;
        continue;
      }

      const jobId = `${target.idempotencyKey}-${target.publishRound}`;
      await this.prisma.postTarget.update({
        where: { id: target.id },
        data: {
          status: PostTargetStatus.QUEUED,
          // Frozen payload: editing the post mid-flight cannot change what actually goes out.
          payloadSnapshot: {
            content: request.content,
            firstComment: request.firstComment,
            mediaAssetIds: request.media.map((m) => m.assetId),
            options: request.options,
          } as unknown as Prisma.InputJsonValue,
          scheduledFor: runAt,
          jobId,
          errorMessage: null,
          errorCode: null,
        },
      });

      await this.queue.add(
        PUBLISH_JOB,
        { targetId: target.id },
        {
          // BullMQ dedupes on jobId, so an accidental double-enqueue of the same round is a
          // silent no-op while a genuine retry (new round) still gets its own job.
          jobId,
          delay: Math.max(0, runAt.getTime() - Date.now()),
          attempts: target.maxAttempts,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      );
      queued++;
    }

    if (queued > 0) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { status: PostStatus.PUBLISHING },
      });
    } else if (skipped > 0) {
      await this.reconcilePost(postId);
    }

    this.audit.record({
      workspaceId: post.workspaceId,
      userId,
      action: "post.publish",
      entityType: "Post",
      entityId: postId,
      metadata: { queued, skipped, publishNow: options.publishNow ?? false },
    });

    return { queued, skipped };
  }

  async cancel(postId: string, userId: string): Promise<{ cancelled: number }> {
    const post = await this.loadForPublish(postId);
    await this.workspaces.assertMembership(post.workspaceId, userId, PUBLISH_ROLES);

    let cancelled = 0;
    for (const target of post.targets) {
      if (TERMINAL.includes(target.status)) continue;

      if (target.jobId) {
        // Only delayed/waiting jobs can be removed; one already executing will notice the status
        // change when it tries its guarded claim.
        const job = await this.queue.getJob(target.jobId);
        await job?.remove().catch(() => undefined);
      }
      await this.prisma.postTarget.update({
        where: { id: target.id },
        data: { status: PostTargetStatus.CANCELLED },
      });
      cancelled++;
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.CANCELLED },
    });
    this.audit.record({
      workspaceId: post.workspaceId,
      userId,
      action: "post.cancel",
      entityType: "Post",
      entityId: postId,
      metadata: { cancelled },
    });

    return { cancelled };
  }

  /** Manual retry of one failed target: a new round, so BullMQ treats it as a brand-new job. */
  async retryTarget(targetId: string, userId: string): Promise<void> {
    const target = await this.prisma.postTarget.findUnique({
      where: { id: targetId },
      include: { post: true },
    });
    if (!target) throw new NotFoundException("Target not found.");
    await this.workspaces.assertMembership(target.post.workspaceId, userId, PUBLISH_ROLES);

    if (target.status === PostTargetStatus.PUBLISHED) {
      throw new ConflictException("This target already published.");
    }

    await this.prisma.postTarget.update({
      where: { id: targetId },
      data: {
        publishRound: { increment: 1 },
        status: PostTargetStatus.PENDING,
        attempts: 0,
        errorMessage: null,
        errorCode: null,
        // containerId is deliberately preserved: if a container was created before the failure,
        // resuming it is what prevents a duplicate post.
      },
    });

    await this.enqueue(target.postId, userId, { publishNow: true });
  }

  /* ------------------------------ Worker support ----------------------------- */

  /**
   * Guarded claim. `updateMany` with a status precondition means only one worker can transition a
   * target into PUBLISHING; a count of 0 says someone else owns it.
   */
  async claimTarget(targetId: string): Promise<boolean> {
    const result = await this.prisma.postTarget.updateMany({
      where: {
        id: targetId,
        status: { in: [PostTargetStatus.QUEUED, PostTargetStatus.RETRYING, PostTargetStatus.PENDING] },
      },
      data: {
        status: PostTargetStatus.PUBLISHING,
        lastAttemptAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async buildRequestForTarget(targetId: string): Promise<PublishRequest> {
    const target = await this.prisma.postTarget.findUniqueOrThrow({
      where: { id: targetId },
      include: {
        socialAccount: true,
        media: { orderBy: { position: "asc" }, select: { mediaAssetId: true } },
        post: {
          include: {
            media: { orderBy: { position: "asc" }, include: { asset: true } },
          },
        },
      },
    });

    const request = await this.buildRequest(target.post, {
      ...target,
      socialAccount: target.socialAccount,
      media: target.media,
    });

    // Credentials are fetched now, not from the snapshot — a token may have rotated since the
    // post was scheduled.
    const credentials = await this.socialAccounts.getPublishCredentials(target.socialAccountId);
    request.account = {
      platform: credentials.platform,
      externalAccountId: credentials.externalAccountId,
      accessToken: credentials.accessToken,
      metadata: credentials.metadata,
    };
    return request;
  }

  providerFor(platform: SocialPlatform) {
    return this.providers[platform];
  }

  /**
   * Removes any waiting/delayed jobs for these targets. Used when rescheduling: without it, a job
   * already delayed until the OLD time would still fire there.
   */
  async cancelQueuedJobs(targets: { jobId: string | null }[]): Promise<void> {
    for (const target of targets) {
      if (!target.jobId) continue;
      const job = await this.queue.getJob(target.jobId);
      // A job already executing can't be removed; its guarded claim will find the changed status.
      await job?.remove().catch(() => undefined);
    }
  }

  async socialAccountIdForTarget(targetId: string): Promise<string | null> {
    const target = await this.prisma.postTarget.findUnique({
      where: { id: targetId },
      select: { socialAccountId: true },
    });
    return target?.socialAccountId ?? null;
  }

  async saveContainerId(targetId: string, containerId: string): Promise<void> {
    await this.prisma.postTarget.update({ where: { id: targetId }, data: { containerId } });
  }

  async markPublished(
    targetId: string,
    platformPostId: string,
    permalink: string | undefined,
    publishedAt: Date,
  ): Promise<void> {
    const target = await this.prisma.postTarget.update({
      where: { id: targetId },
      data: {
        status: PostTargetStatus.PUBLISHED,
        platformPostId,
        permalink: permalink ?? null,
        publishedAt,
        errorMessage: null,
        errorCode: null,
        nextAttemptAt: null,
      },
    });
    await this.reconcilePost(target.postId);
  }

  async markRetrying(targetId: string, message: string, code: string | undefined, delayMs: number) {
    await this.prisma.postTarget.update({
      where: { id: targetId },
      data: {
        status: PostTargetStatus.RETRYING,
        errorMessage: message.slice(0, 500),
        errorCode: code ?? null,
        nextAttemptAt: new Date(Date.now() + delayMs),
      },
    });
  }

  async markFailed(targetId: string, message: string, code?: string): Promise<void> {
    const target = await this.prisma.postTarget.update({
      where: { id: targetId },
      data: {
        status: PostTargetStatus.FAILED,
        errorMessage: message.slice(0, 500),
        errorCode: code ?? null,
        nextAttemptAt: null,
      },
    });
    await this.reconcilePost(target.postId);
  }

  /**
   * PENDING outcome: park the target back in QUEUED and schedule a poll. The attempt is given
   * back deliberately — a five-minute Instagram transcode must not eat the retry budget meant for
   * genuine failures.
   */
  async markAwaitingPlatform(
    targetId: string,
    idempotencyKey: string,
    recheckAfterMs: number,
  ): Promise<void> {
    await this.prisma.postTarget.update({
      where: { id: targetId },
      data: { status: PostTargetStatus.QUEUED, attempts: { decrement: 1 } },
    });

    await this.queue.add(
      PUBLISH_JOB,
      { targetId },
      {
        // A unique id per poll: this is a fresh check, not a retry of the enqueue job, so it must
        // not collide with the round's job id.
        jobId: `${idempotencyKey}-poll-${Date.now()}`,
        delay: recheckAfterMs,
        attempts: 1,
        removeOnComplete: 100,
      },
    );
  }

  async handleInvalidToken(targetId: string, accountId: string, message: string): Promise<void> {
    await this.socialAccounts.markAccountUnhealthy(accountId, message);
    await this.markFailed(targetId, message, "TOKEN_INVALID");
  }

  /**
   * Recomputes Post.status from its targets. Idempotent by construction, so two workers finishing
   * at the same moment racing here is harmless.
   */
  async reconcilePost(postId: string): Promise<PostStatus> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { targets: true },
    });
    if (!post) return PostStatus.FAILED;

    const relevant = post.targets.filter((t) => t.status !== PostTargetStatus.CANCELLED);
    const allTerminal = relevant.every((t) => TERMINAL.includes(t.status));
    if (!allTerminal || relevant.length === 0) return post.status;

    const published = relevant.filter((t) => t.status === PostTargetStatus.PUBLISHED);
    const status =
      published.length === relevant.length
        ? PostStatus.PUBLISHED
        : published.length > 0
          ? PostStatus.PARTIALLY_PUBLISHED
          : PostStatus.FAILED;

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        status,
        publishedAt: published.length > 0 ? (post.publishedAt ?? new Date()) : null,
      },
    });

    await this.notifyOutcome(post.workspaceId, post.authorId, post.title ?? post.content, status);
    return status;
  }

  /* -------------------------------- Internals ------------------------------- */

  private async markSkipped(targetId: string, reason: string): Promise<void> {
    await this.prisma.postTarget.update({
      where: { id: targetId },
      data: {
        status: PostTargetStatus.SKIPPED,
        errorMessage: reason.slice(0, 500),
        errorCode: "VALIDATION",
      },
    });
  }

  private async buildRequest(
    post: {
      id: string;
      content: string;
      contentJson: Prisma.JsonValue | null;
      firstComment: string | null;
      scheduledAt: Date | null;
      media: { mediaAssetId: string; asset: MediaAssetLike }[];
    },
    target: {
      id: string;
      idempotencyKey: string;
      containerId: string | null;
      attempts: number;
      contentOverride: string | null;
      contentJsonOverride: Prisma.JsonValue | null;
      firstCommentOverride: string | null;
      platformOptions: Prisma.JsonValue | null;
      socialAccount: { platform: SocialPlatform; externalAccountId: string };
      media: { mediaAssetId: string }[];
    },
  ): Promise<PublishRequest> {
    const { content, firstComment } = resolveContent(
      { content: post.content, contentJson: post.contentJson, firstComment: post.firstComment },
      {
        contentOverride: target.contentOverride,
        contentJsonOverride: target.contentJsonOverride,
        firstCommentOverride: target.firstCommentOverride,
      },
    );

    // An override set replaces the post's media for this target; empty inherits.
    const overrideIds = target.media.map((m) => m.mediaAssetId);
    let assets: MediaAssetLike[];
    if (overrideIds.length > 0) {
      const found = await this.prisma.mediaAsset.findMany({ where: { id: { in: overrideIds } } });
      const byId = new Map(found.map((a) => [a.id, a]));
      assets = overrideIds.flatMap((id) => {
        const asset = byId.get(id);
        return asset ? [asset] : [];
      });
    } else {
      assets = post.media.map((m) => m.asset);
    }

    return {
      target: {
        id: target.id,
        idempotencyKey: target.idempotencyKey,
        containerId: target.containerId,
        attempts: target.attempts,
      },
      account: {
        platform: target.socialAccount.platform,
        externalAccountId: target.socialAccount.externalAccountId,
        accessToken: "",
        metadata: null,
      },
      content,
      firstComment,
      media: assets.map((asset): PublishMedia => ({
        assetId: asset.id,
        type: asset.type,
        mimeType: asset.mimeType,
        publicUrl: this.publicMediaUrl(asset.storageKey),
        storageKey: asset.storageKey,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
        sizeBytes: asset.sizeBytes,
        altText: asset.altText,
      })),
      options: (target.platformOptions as Record<string, unknown> | null) ?? {},
      scheduledAt: post.scheduledAt,
    };
  }

  /**
   * The URL a *platform's servers* will fetch. Empty when MEDIA_PUBLIC_BASE_URL is unset, which
   * each provider's validate() turns into a clear error rather than an opaque upstream failure.
   */
  private publicMediaUrl(storageKey: string): string {
    if (!this.mediaPublicBase) return "";
    return `${this.mediaPublicBase}/${encodeURI(storageKey)}`;
  }

  private async loadForPublish(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: {
        media: { orderBy: { position: "asc" }, include: { asset: true } },
        targets: {
          include: {
            socialAccount: true,
            media: { orderBy: { position: "asc" }, select: { mediaAssetId: true } },
          },
        },
      },
    });
    if (!post) throw new NotFoundException("Post not found.");
    return post;
  }

  private async notifyOutcome(
    workspaceId: string,
    authorId: string,
    label: string,
    status: PostStatus,
  ): Promise<void> {
    const failed = status === PostStatus.FAILED || status === PostStatus.PARTIALLY_PUBLISHED;
    await this.prisma.notification.create({
      data: {
        workspaceId,
        userId: authorId,
        type: failed ? NotificationType.PUBLISH_FAILED : NotificationType.PUBLISH_SUCCESS,
        title: failed ? "Publishing had problems" : "Post published",
        body: `"${label.slice(0, 60)}" finished with status ${status.toLowerCase().replace("_", " ")}.`,
      },
    });
  }
}

interface MediaAssetLike {
  id: string;
  type: MediaType;
  mimeType: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sizeBytes: number;
  altText: string | null;
}

import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PostStatus, PostTargetStatus, Prisma } from "@prisma/client";
import { isPostEditable } from "@social-platform/shared";
import { RRule } from "rrule";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { PUBLISH_ROLES, VIEW_ROLES } from "../workspaces/lib/roles";
import { PublishingService } from "../posts/publishing/publishing.service";

/** How far ahead of its scheduled time the sweep picks a post up. */
export const DUE_WINDOW_MS = 2 * 60 * 1000;
/** How far ahead recurring occurrences are materialized. */
export const RECURRENCE_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

export interface CalendarEntry {
  postId: string;
  title: string;
  status: PostStatus;
  scheduledAt: string;
  timezone: string;
  targets: {
    id: string;
    platform: string;
    accountName: string;
    status: PostTargetStatus;
    errorMessage: string | null;
    attempts: number;
    nextAttemptAt: string | null;
    permalink: string | null;
  }[];
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly publishing: PublishingService,
  ) {}

  /* --------------------------------- Calendar -------------------------------- */

  async calendar(
    workspaceId: string,
    from: Date,
    to: Date,
    userId: string,
    accountIds?: string[],
  ): Promise<CalendarEntry[]> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);

    const posts = await this.prisma.post.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        scheduledAt: { gte: from, lte: to },
        ...(accountIds?.length
          ? { targets: { some: { socialAccountId: { in: accountIds } } } }
          : {}),
      },
      include: { targets: { include: { socialAccount: true } } },
      orderBy: { scheduledAt: "asc" },
    });

    return posts.map((post) => ({
      postId: post.id,
      title: post.title ?? post.content.split("\n")[0]?.slice(0, 60) ?? "Untitled",
      status: post.status,
      scheduledAt: post.scheduledAt!.toISOString(),
      timezone: post.timezone,
      targets: post.targets.map((t) => ({
        id: t.id,
        platform: t.socialAccount.platform,
        accountName: t.socialAccount.displayName,
        status: t.status,
        errorMessage: t.errorMessage,
        attempts: t.attempts,
        nextAttemptAt: t.nextAttemptAt?.toISOString() ?? null,
        permalink: t.permalink,
      })),
    }));
  }

  /**
   * Drag-to-reschedule. Any job already queued for the old time is removed first — otherwise
   * moving a post later would still fire it at the original moment.
   */
  async reschedule(postId: string, scheduledAt: Date | null, userId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: { targets: true },
    });
    if (!post) throw new NotFoundException("Post not found.");
    await this.workspaces.assertMembership(post.workspaceId, userId, PUBLISH_ROLES);

    // Deliberately the shared helper rather than a hand-written status list. The previous check
    // named PUBLISHED and PUBLISHING but not PARTIALLY_PUBLISHED, so a post that had already gone
    // out to some of its networks could be dragged to a new date on the calendar: this method then
    // reset it to SCHEDULED and put its targets back to PENDING, rewriting a delivery record that
    // had genuinely happened. LOCKED_POST_STATUSES covers all three, and keeping one definition
    // means the next status added to it is enforced here for free.
    if (!isPostEditable(post.status)) {
      throw new BadRequestException(
        "A post that is publishing, published, or partially published cannot be moved.",
      );
    }
    if (scheduledAt && scheduledAt.getTime() < Date.now() - DUE_WINDOW_MS) {
      throw new BadRequestException("Choose a time in the future.");
    }

    await this.publishing.cancelQueuedJobs(post.targets);

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        scheduledAt,
        status: scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT,
        updatedById: userId,
      },
    });
    await this.prisma.postTarget.updateMany({
      where: { postId, status: { in: [PostTargetStatus.QUEUED, PostTargetStatus.RETRYING] } },
      data: { status: PostTargetStatus.PENDING, scheduledFor: scheduledAt },
    });
  }

  /* ---------------------------------- Sweep ---------------------------------- */

  /**
   * Safety net behind BullMQ's own `delay`. Normally the delayed job fires on time and this finds
   * nothing; it exists so a Redis flush, an enqueue that never happened, or a crash mid-enqueue
   * can't leave a post stuck at SCHEDULED forever.
   *
   * Idempotent: enqueue() dedupes on jobId, so re-enqueueing an already-queued target is a no-op.
   */
  async sweepDuePosts(): Promise<{ found: number; enqueued: number }> {
    const due = await this.prisma.post.findMany({
      where: {
        status: PostStatus.SCHEDULED,
        deletedAt: null,
        scheduledAt: { lte: new Date(Date.now() + DUE_WINDOW_MS) },
      },
      select: { id: true, authorId: true },
      take: 100,
    });

    let enqueued = 0;
    for (const post of due) {
      try {
        // Runs as the post's author: the sweep has no session, and the author necessarily had
        // permission at the moment they scheduled it.
        const result = await this.publishing.enqueue(post.id, post.authorId);
        if (result.queued > 0) enqueued++;
      } catch (err) {
        this.logger.warn(`Sweep could not enqueue post ${post.id}: ${String(err)}`);
      }
    }

    if (due.length > 0) {
      this.logger.log(`Schedule sweep: ${due.length} due, ${enqueued} enqueued`);
    }
    return { found: due.length, enqueued };
  }

  /* -------------------------------- Recurrence ------------------------------- */

  /**
   * Materializes upcoming occurrences of recurring posts as fresh Post rows.
   *
   * Cloning rather than republishing one row is the whole design: each occurrence needs its own
   * publishedAt, its own PostTargets and its own analytics identity.
   */
  async materializeRecurrences(): Promise<{ created: number }> {
    const templates = await this.prisma.post.findMany({
      where: { recurrenceRule: { not: null }, recurrenceParentId: null, deletedAt: null },
      include: {
        media: { orderBy: { position: "asc" } },
        targets: true,
        recurrenceChildren: { select: { scheduledAt: true } },
      },
      take: 50,
    });

    const horizon = new Date(Date.now() + RECURRENCE_HORIZON_MS);
    let created = 0;

    for (const template of templates) {
      if (!template.scheduledAt) continue;

      let occurrences: Date[];
      try {
        occurrences = this.expand(template.recurrenceRule!, new Date(), horizon);
      } catch (err) {
        this.logger.warn(`Invalid recurrenceRule on post ${template.id}: ${String(err)}`);
        continue;
      }

      const existing = new Set(
        template.recurrenceChildren
          .map((c) => c.scheduledAt?.toISOString())
          .filter((v): v is string => Boolean(v)),
      );

      for (const occurrence of occurrences) {
        if (template.recurrenceEndsAt && occurrence > template.recurrenceEndsAt) break;
        if (existing.has(occurrence.toISOString())) continue;
        if (
          template.recurrenceCount &&
          template.recurrenceChildren.length + created >= template.recurrenceCount
        ) {
          break;
        }

        await this.prisma.post.create({
          data: {
            workspaceId: template.workspaceId,
            authorId: template.authorId,
            recurrenceParentId: template.id,
            title: template.title,
            content: template.content,
            contentJson: template.contentJson ?? Prisma.DbNull,
            firstComment: template.firstComment,
            campaignId: template.campaignId,
            timezone: template.timezone,
            scheduledAt: occurrence,
            status: PostStatus.SCHEDULED,
            media: {
              create: template.media.map((m) => ({
                mediaAssetId: m.mediaAssetId,
                position: m.position,
              })),
            },
            targets: {
              create: template.targets.map((t) => ({
                socialAccountId: t.socialAccountId,
                contentOverride: t.contentOverride,
                contentJsonOverride: t.contentJsonOverride ?? Prisma.DbNull,
                firstCommentOverride: t.firstCommentOverride,
                platformOptions: t.platformOptions ?? Prisma.DbNull,
              })),
            },
          },
        });
        created++;
      }
    }

    if (created > 0) this.logger.log(`Materialized ${created} recurring occurrence(s)`);
    return { created };
  }

  expand(rule: string, from: Date, to: Date): Date[] {
    const normalized = rule.startsWith("RRULE:") ? rule : `RRULE:${rule}`;
    return RRule.fromString(normalized).between(from, to, true);
  }

  /** Validates an RRULE before it's stored, so a typo fails in the composer not in the sweep. */
  static validateRecurrenceRule(rule: string): string | null {
    try {
      RRule.fromString(rule.startsWith("RRULE:") ? rule : `RRULE:${rule}`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid recurrence rule";
    }
  }
}

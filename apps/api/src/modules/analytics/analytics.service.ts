import { Injectable } from "@nestjs/common";
import { PostStatus, PostTargetStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { VIEW_ROLES } from "../workspaces/lib/roles";

export interface WorkspaceOverview {
  totals: {
    posts: number;
    published: number;
    scheduled: number;
    drafts: number;
    awaitingApproval: number;
    failed: number;
    mediaAssets: number;
  };
  /** Publish reliability, derived from PostTarget outcomes — the platform's own record. */
  delivery: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    successRate: number;
  };
  byPlatform: { platform: string; published: number; failed: number }[];
  /** Published-post counts per day for the requested window. */
  timeline: { date: string; published: number }[];
  topCampaigns: { id: string; name: string; postCount: number; publishedCount: number }[];
  recentFailures: {
    postId: string;
    title: string;
    platform: string;
    accountName: string;
    errorMessage: string | null;
    attempts: number;
  }[];
}

/**
 * Reporting over what this platform actually knows: how much content exists, and how reliably it
 * reached each destination.
 *
 * Deliberately NOT reach/impressions/engagement — those require polling each platform's insights
 * API, and `AnalyticsSnapshot` (account-level, no per-post link) has never been populated.
 * Reporting fabricated or empty engagement numbers would be worse than reporting none.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async overview(
    workspaceId: string,
    userId: string,
    days = 30,
  ): Promise<WorkspaceOverview> {
    await this.workspaces.assertMembership(workspaceId, userId, VIEW_ROLES);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [statusCounts, mediaCount, targets, campaigns, failures] = await Promise.all([
      this.prisma.post.groupBy({
        by: ["status"],
        where: { workspaceId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.mediaAsset.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.postTarget.findMany({
        where: { post: { workspaceId, deletedAt: null } },
        select: {
          status: true,
          publishedAt: true,
          socialAccount: { select: { platform: true } },
        },
      }),
      this.prisma.campaign.findMany({
        where: { workspaceId, deletedAt: null },
        include: {
          _count: { select: { posts: { where: { deletedAt: null } } } },
          posts: { where: { deletedAt: null, status: PostStatus.PUBLISHED }, select: { id: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.postTarget.findMany({
        where: {
          post: { workspaceId, deletedAt: null },
          status: { in: [PostTargetStatus.FAILED, PostTargetStatus.SKIPPED] },
        },
        include: {
          socialAccount: { select: { platform: true, displayName: true } },
          post: { select: { id: true, title: true, content: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    const countFor = (status: PostStatus) =>
      statusCounts.find((s) => s.status === status)?._count._all ?? 0;

    const succeeded = targets.filter((t) => t.status === PostTargetStatus.PUBLISHED).length;
    const failed = targets.filter((t) => t.status === PostTargetStatus.FAILED).length;
    const skipped = targets.filter((t) => t.status === PostTargetStatus.SKIPPED).length;
    const attempted = succeeded + failed;

    const byPlatform = new Map<string, { published: number; failed: number }>();
    for (const target of targets) {
      const platform = target.socialAccount.platform;
      const row = byPlatform.get(platform) ?? { published: 0, failed: 0 };
      if (target.status === PostTargetStatus.PUBLISHED) row.published++;
      if (target.status === PostTargetStatus.FAILED) row.failed++;
      byPlatform.set(platform, row);
    }

    // Zero-filled so the chart has a continuous x-axis rather than gaps on quiet days.
    const timeline = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      timeline.set(day.toISOString().slice(0, 10), 0);
    }
    for (const target of targets) {
      if (!target.publishedAt || target.publishedAt < since) continue;
      const key = target.publishedAt.toISOString().slice(0, 10);
      if (timeline.has(key)) timeline.set(key, (timeline.get(key) ?? 0) + 1);
    }

    return {
      totals: {
        posts: statusCounts.reduce((sum, s) => sum + s._count._all, 0),
        published: countFor(PostStatus.PUBLISHED) + countFor(PostStatus.PARTIALLY_PUBLISHED),
        scheduled: countFor(PostStatus.SCHEDULED),
        drafts: countFor(PostStatus.DRAFT),
        awaitingApproval: countFor(PostStatus.PENDING_APPROVAL),
        failed: countFor(PostStatus.FAILED),
        mediaAssets: mediaCount,
      },
      delivery: {
        attempted,
        succeeded,
        failed,
        skipped,
        successRate: attempted === 0 ? 0 : Math.round((succeeded / attempted) * 100),
      },
      byPlatform: Array.from(byPlatform.entries())
        .map(([platform, row]) => ({ platform, ...row }))
        .sort((a, b) => b.published - a.published),
      timeline: Array.from(timeline.entries()).map(([date, published]) => ({ date, published })),
      topCampaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        postCount: c._count.posts,
        publishedCount: c.posts.length,
      })),
      recentFailures: failures.map((f) => ({
        postId: f.post.id,
        title: f.post.title ?? f.post.content.slice(0, 60) ?? "Untitled",
        platform: f.socialAccount.platform,
        accountName: f.socialAccount.displayName,
        errorMessage: f.errorMessage,
        attempts: f.attempts,
      })),
    };
  }
}

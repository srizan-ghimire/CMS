import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { WorkspaceRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { PUBLISH_QUEUE } from "../posts/publishing/publishing.constants";
import { MEDIA_QUEUE } from "../media/processors/media-processing.processor";

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

/**
 * Operational surface: the audit trail, feature flags, plans and queue depth.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly audit: AuditService,
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue,
    @InjectQueue(MEDIA_QUEUE) private readonly mediaQueue: Queue,
  ) {}

  /* -------------------------------- Audit log -------------------------------- */

  /** Workspace-scoped: an ADMIN sees their own workspace's trail, not the whole platform's. */
  async auditLog(workspaceId: string, userId: string, limit = 100, cursor?: string) {
    await this.workspaces.assertMembership(workspaceId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);
    return this.audit.list(workspaceId, limit, cursor);
  }

  /* ------------------------------ Feature flags ------------------------------ */

  async listFlags() {
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
    return flags.map((f) => ({
      key: f.key,
      enabled: f.enabled,
      rolloutPercentage: f.rolloutPercentage,
      updatedAt: f.updatedAt.toISOString(),
    }));
  }

  /**
   * Deterministic per-subject rollout: the same user always lands on the same side of the
   * percentage, so a partially-rolled-out feature does not flicker between requests.
   */
  async isEnabled(key: string, subjectId?: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag || !flag.enabled) return false;
    if (flag.rolloutPercentage >= 100) return true;
    if (!subjectId) return false;

    let hash = 0;
    for (let i = 0; i < subjectId.length; i++) {
      hash = (hash * 31 + subjectId.charCodeAt(i)) % 100_000;
    }
    return hash % 100 < flag.rolloutPercentage;
  }

  async setFlag(
    key: string,
    input: { enabled?: boolean; rolloutPercentage?: number },
    userId: string,
  ) {
    await this.assertPlatformAdmin(userId);
    const flag = await this.prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        enabled: input.enabled ?? false,
        rolloutPercentage: input.rolloutPercentage ?? 0,
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.rolloutPercentage !== undefined
          ? { rolloutPercentage: input.rolloutPercentage }
          : {}),
      },
    });

    return {
      key: flag.key,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      updatedAt: flag.updatedAt.toISOString(),
    };
  }

  /* ---------------------------------- Plans ---------------------------------- */

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      include: { _count: { select: { workspaces: true } } },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      priceMonthly: p.priceMonthly,
      postLimit: p.postLimit,
      seatLimit: p.seatLimit,
      socialLimit: p.socialLimit,
      workspaceCount: p._count.workspaces,
    }));
  }

  /* --------------------------------- Queues ---------------------------------- */

  async queueStats(userId: string): Promise<QueueStats[]> {
    await this.assertPlatformAdmin(userId);
    return Promise.all(
      [this.publishQueue, this.mediaQueue].map(async (queue) => {
        const counts = await queue.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "failed",
          "completed",
        );
        return {
          name: queue.name,
          waiting: counts["waiting"] ?? 0,
          active: counts["active"] ?? 0,
          delayed: counts["delayed"] ?? 0,
          failed: counts["failed"] ?? 0,
          completed: counts["completed"] ?? 0,
        };
      }),
    );
  }

  /**
   * There is no platform-superuser concept in the schema, so "platform admin" is approximated as
   * "owns at least one workspace". Documented rather than silently permissive: a real deployment
   * should add a `User.isPlatformAdmin` column and check that instead.
   */
  private async assertPlatformAdmin(userId: string): Promise<void> {
    const owned = await this.prisma.workspace.count({
      where: { ownerId: userId, deletedAt: null },
    });
    if (owned === 0) {
      throw new ForbiddenException("Platform administration requires workspace ownership.");
    }
  }
}

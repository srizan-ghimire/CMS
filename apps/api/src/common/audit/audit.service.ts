import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type AuditAction =
  | "post.create"
  | "post.update"
  | "post.delete"
  | "post.restore"
  | "post.archive"
  | "post.publish"
  | "post.cancel"
  | "post.version_restore"
  | "approval.request"
  | "approval.decide"
  | "media.upload"
  | "media.delete"
  | "tag.create"
  | "tag.delete"
  | "campaign.create"
  | "campaign.delete"
  | "template.create"
  | "template.delete"
  | "social_account.connect"
  | "social_account.disconnect";

/**
 * Writes to the `audit_logs` table, which has existed since Phase 1 without a single caller.
 *
 * Deliberately fire-and-forget: an audit write must never fail the operation it describes. A
 * dropped audit row is a gap in the record; a failed publish because the audit insert deadlocked
 * is a production incident.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(entry: {
    workspaceId?: string | null;
    userId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  }): void {
    void this.prisma.auditLog
      .create({
        data: {
          workspaceId: entry.workspaceId ?? null,
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: (entry.metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
          ipAddress: entry.ipAddress ?? null,
        },
      })
      .catch((err: unknown) => {
        this.logger.warn(`Audit write failed for ${entry.action} ${entry.entityId}: ${String(err)}`);
      });
  }

  /** Reads the trail for one workspace. Used by the admin viewer. */
  async list(workspaceId: string, limit = 100, cursor?: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { name: true, email: true } } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        userName: row.user?.name ?? null,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}

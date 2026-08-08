import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface NotificationDto {
  id: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

/**
 * Delivery for the notification rows that publishing, approvals and the token-refresh sweep have
 * been writing all along.
 *
 * Polling rather than WebSocket push: notifications here are low-frequency (a publish outcome, an
 * approval request), the payload is tiny, and polling survives the reconnect/auth edge cases a
 * socket would introduce for no user-visible gain at this volume.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, unreadOnly = false, limit = 50) {
    const items = await this.prisma.notification.findMany({
      // Scoped by userId, not workspace: a notification is addressed to a person.
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    return {
      items: items.map((n) => ({
        id: n.id,
        workspaceId: n.workspaceId,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    // updateMany with the userId in the filter, so one user cannot mark another's notification
    // read by guessing an id.
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException("Notification not found.");
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}

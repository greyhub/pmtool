import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationDto,
  NotificationListDto,
  NotificationType,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotifyInput {
  organizationId: string;
  /** Recipients; the actor is removed and duplicates collapse. */
  userIds: Iterable<string | null | undefined>;
  type: NotificationType;
  actorId?: string | null;
  entityKind: 'task' | 'deliverable';
  entityId: string;
  projectKey: string;
  entityTitle: string;
  detail?: string | null;
}

const EXCERPT = 160;

/** Tells people about things that concern them. Failing to notify must never fail the action that caused it. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput): Promise<void> {
    try {
      const recipients = Array.from(
        new Set(
          Array.from(input.userIds).filter(
            (x): x is string => !!x && x !== input.actorId,
          ),
        ),
      );
      if (recipients.length === 0) return;
      const actor = input.actorId
        ? await this.prisma.db.user.findUnique({
            where: { id: input.actorId },
            select: { fullName: true },
          })
        : null;
      await this.prisma.db.notification.createMany({
        data: recipients.map((userId) => ({
          organizationId: input.organizationId,
          userId,
          type: input.type,
          actorId: input.actorId ?? null,
          actorName: actor?.fullName ?? null,
          entityKind: input.entityKind,
          entityId: input.entityId,
          projectKey: input.projectKey,
          entityTitle: input.entityTitle.slice(0, 300),
          detail: input.detail ? input.detail.slice(0, EXCERPT) : null,
        })),
      });
    } catch (err) {
      this.logger.warn(
        `Could not create notification: ${(err as Error).message}`,
      );
    }
  }

  async list(
    organizationId: string,
    userId: string,
    limit = 30,
  ): Promise<NotificationListDto> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.db.notification.findMany({
        where: { organizationId, userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
      }),
      this.prisma.db.notification.count({
        where: { organizationId, userId, readAt: null },
      }),
    ]);
    const items: NotificationDto[] = rows.map((n) => ({
      id: n.id,
      type: n.type as NotificationType,
      actorName: n.actorName,
      entityKind: n.entityKind as 'task' | 'deliverable',
      entityId: n.entityId,
      projectKey: n.projectKey,
      entityTitle: n.entityTitle,
      detail: n.detail,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    }));
    return { items, unreadCount };
  }

  async markRead(
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<void> {
    await this.prisma.db.notification.updateMany({
      where: { id, organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(organizationId: string, userId: string): Promise<void> {
    await this.prisma.db.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

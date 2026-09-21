import { Injectable } from '@nestjs/common';
import { ActivityLog, OrgRole, User } from '@prisma/client';
import { hiddenProjectIds } from '../../common/project-visibility';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordActivityInput {
  organizationId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  projectId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}

const ACTOR_SELECT = { id: true, fullName: true, avatarUrl: true } as const;
const FEED_TAKE = 20;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Best-effort: called from AuditLogInterceptor after a mutation already succeeded, so a logging failure must never surface as a request error. */
  async record(input: RecordActivityInput): Promise<void> {
    await this.prisma.db.activityLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId,
        action: input.action,
        metadata: input.metadata,
      },
    });
  }

  async listForOrg(
    organizationId: string,
    userId: string,
    role: OrgRole,
  ): Promise<
    (ActivityLog & { actor: Pick<User, 'id' | 'fullName' | 'avatarUrl'> })[]
  > {
    const hidden = await hiddenProjectIds(
      this.prisma,
      organizationId,
      userId,
      role,
    );
    return this.prisma.db.activityLog.findMany({
      where: {
        organizationId,
        // Entries of a private project the caller cannot see stay out of the feed.
        OR: [{ projectId: null }, { projectId: { notIn: hidden } }],
      },
      include: { actor: { select: ACTOR_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: FEED_TAKE,
    });
  }

  async listForEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    take = 100,
  ): Promise<
    (ActivityLog & { actor: Pick<User, 'id' | 'fullName' | 'avatarUrl'> })[]
  > {
    return this.prisma.db.activityLog.findMany({
      where: { organizationId, entityType, entityId },
      include: { actor: { select: ACTOR_SELECT } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}

import { ActivityLog, User } from '@prisma/client';
import { ActivityLogDto } from '@pmtool/shared-types';

type ActivityLogWithActor = ActivityLog & {
  actor: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
};

export function toActivityLogDto(log: ActivityLogWithActor): ActivityLogDto {
  return {
    id: log.id,
    organizationId: log.organizationId,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    metadata: (log.metadata as Record<string, unknown> | null) ?? null,
    actor: {
      id: log.actor.id,
      fullName: log.actor.fullName,
      avatarUrl: log.actor.avatarUrl,
    },
    createdAt: log.createdAt.toISOString(),
  };
}

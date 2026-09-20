import { ActivityLog, User } from '@prisma/client';
import { TaskChangeDto, TaskHistoryEntryDto } from '@pmtool/shared-types';

type Row = ActivityLog & {
  actor: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
};

/**
 * A task's timeline from its ActivityLog rows: the creation, plus every
 * update that actually changed something (no-op saves and moves are left
 * out — they say nothing about the task's content).
 */
export function toTaskHistory(rows: Row[]): TaskHistoryEntryDto[] {
  const out: TaskHistoryEntryDto[] = [];
  for (const row of rows) {
    if (row.action !== 'created' && row.action !== 'updated') continue;
    const changes =
      (row.metadata as { changes?: TaskChangeDto[] } | null)?.changes ?? [];
    if (row.action === 'updated' && changes.length === 0) continue;
    out.push({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      actor: {
        id: row.actor.id,
        fullName: row.actor.fullName,
        avatarUrl: row.actor.avatarUrl,
      },
      changes,
    });
  }
  return out;
}

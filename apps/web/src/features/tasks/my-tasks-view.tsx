'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMyTasks } from '@pmtool/api-client';
import type { MyTaskDto } from '@pmtool/shared-types';
import { Badge, Card } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { formatDate } from '../../lib/date-input';
import { TaskStatusBadge } from './task-badges';

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
const BUCKETS: Bucket[] = ['overdue', 'today', 'week', 'later', 'none'];
const DAY_MS = 86_400_000;

function bucketOf(task: MyTaskDto, now = new Date()): Bucket {
  if (!task.dueDate) return 'none';
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((day(new Date(task.dueDate)) - day(now)) / DAY_MS);
  if (days < 0 && task.status !== 'DONE') return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return days < 0 ? 'later' : 'week';
  return 'later';
}

/** Everything assigned to me, across all projects, grouped by how soon it is due. */
export function MyTasksView({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('myTasks');
  const [includeDone, setIncludeDone] = useState(false);
  const { data: tasks, isLoading } = useMyTasks(orgSlug, includeDone);

  const groups = useMemo(() => {
    const map = new Map<Bucket, MyTaskDto[]>(BUCKETS.map((b) => [b, []]));
    for (const task of tasks ?? []) map.get(bucketOf(task))!.push(task);
    return map;
  }, [tasks]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => setIncludeDone(e.target.checked)}
            className="h-4 w-4 accent-action-primary"
          />
          {t('showDone')}
        </label>
      </div>

      {isLoading ? null : !tasks || tasks.length === 0 ? (
        <Card className="mt-6 p-6 text-sm text-ink-secondary">{t('empty')}</Card>
      ) : (
        <div className="mt-6 flex flex-col gap-6" data-testid="my-tasks">
          {BUCKETS.filter((b) => (groups.get(b) ?? []).length > 0).map((b) => (
            <section key={b} aria-labelledby={`bucket-${b}`}>
              <h2
                id={`bucket-${b}`}
                className={`mb-2 text-sm font-semibold ${b === 'overdue' ? 'text-danger' : 'text-ink-secondary'}`}
              >
                {t(`buckets.${b}`)} <span className="font-normal text-ink-muted">({groups.get(b)!.length})</span>
              </h2>
              <Card className="divide-y divide-line p-0">
                {groups.get(b)!.map((task) => (
                  <Link
                    key={task.id}
                    href={`/${orgSlug}/projects/${task.projectKey}/tasks/${task.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-subtle"
                  >
                    <span className="font-mono text-xs text-ink-muted">
                      {task.isMilestone ? '◆ ' : ''}
                      {task.humanKey}
                    </span>
                    <span className="min-w-0 flex-1 basis-[12rem] text-sm text-ink-primary">{task.title}</span>
                    <span className="hidden text-xs text-ink-muted sm:inline">{task.projectName}</span>
                    <Badge variant={task.role === 'PRIMARY' ? 'primary' : 'neutral'}>{t(`roles.${task.role}`)}</Badge>
                    <TaskStatusBadge status={task.status} />
                    {task.percentComplete > 0 && (
                      <span className="text-xs tabular-nums text-ink-secondary">{task.percentComplete}%</span>
                    )}
                    <span
                      className={`w-20 text-right text-xs tabular-nums ${b === 'overdue' ? 'text-danger' : 'text-ink-secondary'}`}
                    >
                      {task.dueDate ? formatDate(task.dueDate) : '—'}
                    </span>
                  </Link>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

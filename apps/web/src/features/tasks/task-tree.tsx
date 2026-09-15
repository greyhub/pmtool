'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskDto } from '@pmtool/shared-types';
import { Avatar } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { TaskPriorityBadge, TaskStatusBadge } from './task-badges';
import { CreateTaskModal } from './create-task-modal';

function groupByParent(tasks: TaskDto[]): Map<string | null, TaskDto[]> {
  const map = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const key = task.parentTaskId;
    const siblings = map.get(key) ?? [];
    siblings.push(task);
    map.set(key, siblings);
  }
  return map;
}

function TaskRow({
  task,
  depth,
  grouped,
  orgSlug,
  projectKey,
}: {
  task: TaskDto;
  depth: number;
  grouped: Map<string | null, TaskDto[]>;
  orgSlug: string;
  projectKey: string;
}) {
  const t = useTranslations('tasks.list');
  const [expanded, setExpanded] = useState(true);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const children = grouped.get(task.id) ?? [];

  return (
    <>
      <div
        className="group flex items-center gap-2 border-b border-line px-2 py-2 hover:bg-surface-subtle"
        style={{ paddingLeft: 8 + depth * 24 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-muted"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <Link
          href={`/${orgSlug}/projects/${projectKey}/tasks/${task.id}`}
          className="shrink-0 font-mono text-xs text-ink-muted hover:underline"
        >
          {task.humanKey}
        </Link>
        <Link href={`/${orgSlug}/projects/${projectKey}/tasks/${task.id}`} className="flex-1 truncate text-sm text-ink-primary hover:underline">
          {task.title}
        </Link>

        <div className="flex shrink-0 -space-x-2">
          {task.assignees.map((a) => (
            <Avatar key={a.id} name={a.fullName} src={a.avatarUrl} size="sm" className="ring-2 ring-surface" />
          ))}
        </div>
        <div className="shrink-0">
          <TaskPriorityBadge priority={task.priority} />
        </div>
        <div className="shrink-0">
          <TaskStatusBadge status={task.status} />
        </div>
        <button
          type="button"
          onClick={() => setAddingSubtask(true)}
          className="shrink-0 rounded px-2 py-1 text-xs text-ink-muted opacity-0 hover:bg-surface-subtle hover:text-ink-primary group-hover:opacity-100"
        >
          {t('addSubtask')}
        </button>
      </div>

      {expanded &&
        children.map((child) => (
          <TaskRow key={child.id} task={child} depth={depth + 1} grouped={grouped} orgSlug={orgSlug} projectKey={projectKey} />
        ))}

      <CreateTaskModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        parentTaskId={task.id}
        open={addingSubtask}
        onClose={() => setAddingSubtask(false)}
      />
    </>
  );
}

export function TaskTree({ tasks, orgSlug, projectKey }: { tasks: TaskDto[]; orgSlug: string; projectKey: string }) {
  const grouped = useMemo(() => groupByParent(tasks), [tasks]);
  const roots = grouped.get(null) ?? [];

  return (
    <div>
      {roots.map((task) => (
        <TaskRow key={task.id} task={task} depth={0} grouped={grouped} orgSlug={orgSlug} projectKey={projectKey} />
      ))}
    </div>
  );
}

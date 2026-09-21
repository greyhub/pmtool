'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMoveTask, useUpdateTaskById } from '@pmtool/api-client';
import { TASK_STATUSES, type TaskDto } from '@pmtool/shared-types';
import { Avatar, Badge } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { formatDate } from '../../lib/date-input';
import { TaskPriorityBadge } from './task-badges';
import { CreateTaskModal } from './create-task-modal';
import { dueState, type DueState } from './task-filters';
import { neighbourSiblings, planMove, type DropZone } from '../wbs/wbs-move';

interface Reorder {
  dragId: string | null;
  over: { id: string; zone: DropZone } | null;
  setDragId: (id: string | null) => void;
  setOver: (over: { id: string; zone: DropZone } | null) => void;
  allTasks: TaskDto[];
  moveTo: (taskId: string, targetId: string, zone: DropZone) => void;
}
/** Present only while drag-and-drop ordering makes sense (unfiltered, default order). */
const ReorderCtx = createContext<Reorder | null>(null);

const DUE_VARIANT: Record<DueState, 'danger' | 'warning' | 'neutral'> = {
  overdue: 'danger',
  today: 'warning',
  soon: 'warning',
  normal: 'neutral',
  done: 'neutral',
};

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

function AssigneeStack({ task }: { task: TaskDto }) {
  const tRoles = useTranslations('tasks.roles');
  const primary = task.assignees.find((a) => a.role === 'PRIMARY');
  const supporters = task.assignees.filter((a) => a.role === 'SUPPORT');
  if (!primary && supporters.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {primary && (
        <span title={`${primary.fullName} — ${tRoles('assignee')}`}>
          <Avatar name={primary.fullName} src={primary.avatarUrl} size="sm" className="ring-2 ring-action-primary" />
        </span>
      )}
      {supporters.length > 0 && (
        <span
          title={supporters.map((s) => `${s.fullName} — ${tRoles('supporter')}`).join('\n')}
          className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-xs text-ink-secondary"
        >
          +{supporters.length}
        </span>
      )}
    </span>
  );
}

function InlineStatus({ task, orgSlug, projectKey }: { task: TaskDto; orgSlug: string; projectKey: string }) {
  const tStatus = useTranslations('tasks.status');
  const update = useUpdateTaskById(orgSlug, projectKey);
  return (
    <select
      aria-label={`${tStatus('label')} ${task.humanKey}`}
      value={task.status}
      disabled={update.isPending}
      onChange={(e) => update.mutate({ taskId: task.id, input: { status: e.target.value as TaskDto['status'] } })}
      className="h-7 shrink-0 glass-field rounded-md border border-line-glass px-1.5 text-xs text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {tStatus(s)}
        </option>
      ))}
    </select>
  );
}

function TaskRow({
  task,
  depth,
  grouped,
  orgSlug,
  projectKey,
  collapsed,
  toggle,
  forceExpanded,
}: {
  task: TaskDto;
  depth: number;
  grouped: Map<string | null, TaskDto[]>;
  orgSlug: string;
  projectKey: string;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  forceExpanded: boolean;
}) {
  const t = useTranslations('tasks.list');
  const reorder = useContext(ReorderCtx);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const children = grouped.get(task.id) ?? [];
  const expanded = forceExpanded || !collapsed.has(task.id);
  const href = `/${orgSlug}/projects/${projectKey}/tasks/${task.id}`;
  const due = dueState(task.dueDate, task.status);
  const doneChildren = children.filter((c) => c.status === 'DONE').length;

  return (
    <>
      <div
        data-testid={`task-row-${task.humanKey}`}
        draggable={Boolean(reorder)}
        onDragStart={(e) => {
          if (!reorder) return;
          reorder.setDragId(task.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', task.id);
        }}
        onDragEnd={() => {
          reorder?.setDragId(null);
          reorder?.setOver(null);
        }}
        onDragOver={(e) => {
          if (!reorder?.dragId) return;
          const box = e.currentTarget.getBoundingClientRect();
          const y = (e.clientY - box.top) / box.height;
          const zone: DropZone = y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
          if (!planMove(reorder.allTasks, reorder.dragId, task.id, zone)) {
            reorder.setOver(null);
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (reorder.over?.id !== task.id || reorder.over.zone !== zone) reorder.setOver({ id: task.id, zone });
        }}
        onDrop={(e) => {
          if (!reorder) return;
          e.preventDefault();
          if (reorder.dragId && reorder.over) reorder.moveTo(reorder.dragId, reorder.over.id, reorder.over.zone);
          reorder.setDragId(null);
          reorder.setOver(null);
        }}
        className={`group border-b border-line px-2 py-2 hover:bg-surface-subtle ${
          reorder?.dragId === task.id ? 'opacity-40' : ''
        } ${reorder?.over?.id === task.id && reorder.over.zone === 'inside' ? 'ring-2 ring-inset ring-action-primary' : ''} ${
          reorder?.over?.id === task.id && reorder.over.zone === 'before' ? 'border-t-2 border-t-action-primary' : ''
        } ${reorder?.over?.id === task.id && reorder.over.zone === 'after' ? 'border-b-2 border-b-action-primary' : ''}`}
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(task.id)}
              aria-label={expanded ? t('collapse') : t('expand')}
              aria-expanded={expanded}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-surface-subtle"
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
            <span className="w-6 shrink-0" />
          )}

          {reorder && (
            <span className="flex shrink-0 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
              {(
                [
                  ['up', '↑', t('moveUp')],
                  ['down', '↓', t('moveDown')],
                ] as const
              ).map(([action, glyph, label]) => (
                <button
                  key={action}
                  type="button"
                  aria-label={`${label}: ${task.title}`}
                  title={label}
                  onClick={() => {
                    const { prev, next } = neighbourSiblings(reorder.allTasks, task.id);
                    if (action === 'up' && prev) reorder.moveTo(task.id, prev.id, 'before');
                    if (action === 'down' && next) reorder.moveTo(task.id, next.id, 'after');
                  }}
                  className="h-6 w-5 rounded text-xs text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
                >
                  {glyph}
                </button>
              ))}
            </span>
          )}
          <Link href={href} className="shrink-0 font-mono text-xs text-ink-muted hover:underline">
            {task.isMilestone && (
              <span aria-label={t('milestone')} title={t('milestone')} className="mr-1 text-action-primary">
                ◆
              </span>
            )}
            {task.humanKey}
          </Link>
          <Link
            href={href}
            title={task.title}
            className="min-w-0 flex-1 basis-[11rem] break-words text-sm text-ink-primary hover:underline sm:truncate"
          >
            {task.title}
          </Link>

          <button
            type="button"
            onClick={() => setAddingSubtask(true)}
            aria-label={`${t('addSubtask')} — ${task.humanKey}`}
            title={t('addSubtask')}
            className="flex h-7 w-7 shrink-0 sm:order-last items-center justify-center rounded text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
          >
            +
          </button>
          <div className="ml-8 flex flex-wrap items-center gap-2 sm:ml-0 sm:flex-nowrap">
            <AssigneeStack task={task} />
            {task.dueDate && due && (
              <Badge
                variant={DUE_VARIANT[due]}
                title={`${t('due')}: ${formatDate(task.dueDate)}`}
                className={due === 'done' ? 'opacity-60' : undefined}
              >
                {due === 'overdue' ? `${t('overdue')} · ` : ''}
                {new Date(task.dueDate).toLocaleDateString('vi-VN', {
                  day: 'numeric',
                  month: 'numeric',
                  timeZone: 'UTC',
                })}
              </Badge>
            )}
            {children.length > 0 ? (
              <span
                title={t('subtasksDone', { done: doneChildren, total: children.length })}
                className="shrink-0 text-xs tabular-nums text-ink-secondary"
              >
                {doneChildren}/{children.length}
              </span>
            ) : (
              task.percentComplete > 0 && (
                <span
                  title={`${task.percentComplete}%`}
                  className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-ink-secondary"
                >
                  <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-subtle">
                    <span
                      className="block h-full rounded-full bg-action-primary"
                      style={{ width: `${task.percentComplete}%` }}
                    />
                  </span>
                  {task.percentComplete}%
                </span>
              )
            )}
            <TaskPriorityBadge priority={task.priority} />
            <InlineStatus task={task} orgSlug={orgSlug} projectKey={projectKey} />
          </div>
        </div>
      </div>

      {expanded &&
        children.map((child) => (
          <TaskRow
            key={child.id}
            task={child}
            depth={depth + 1}
            grouped={grouped}
            orgSlug={orgSlug}
            projectKey={projectKey}
            collapsed={collapsed}
            toggle={toggle}
            forceExpanded={forceExpanded}
          />
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

export function TaskTree({
  tasks,
  orgSlug,
  projectKey,
  forceExpanded = false,
  collapsed,
  onToggle,
  reorderAmong,
}: {
  tasks: TaskDto[];
  orgSlug: string;
  projectKey: string;
  /** While filtering, every parent is shown open so matches are never hidden inside a collapsed row. */
  forceExpanded?: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  /** Every task of the project; when given, rows can be dragged to reorder or re-parent them. */
  reorderAmong?: TaskDto[];
}) {
  const grouped = useMemo(() => groupByParent(tasks), [tasks]);
  const roots = grouped.get(null) ?? [];
  const moveTask = useMoveTask(orgSlug, projectKey);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; zone: DropZone } | null>(null);
  const reorder: Reorder | null = reorderAmong
    ? {
        dragId,
        over,
        setDragId,
        setOver,
        allTasks: reorderAmong,
        moveTo: (taskId, targetId, zone) => {
          const plan = planMove(reorderAmong, taskId, targetId, zone);
          if (plan) moveTask.mutate({ taskId, input: plan });
        },
      }
    : null;

  return (
    <ReorderCtx.Provider value={reorder}>
      <div>
        {roots.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            depth={0}
            grouped={grouped}
            orgSlug={orgSlug}
            projectKey={projectKey}
            collapsed={collapsed}
            toggle={onToggle}
            forceExpanded={forceExpanded}
          />
        ))}
      </div>
    </ReorderCtx.Provider>
  );
}

/** Which parent rows are collapsed, remembered per project so a reload keeps the tree as you left it. */
export function useCollapsedRows(orgSlug: string, projectKey: string) {
  const storageKey = `pmtool:tasks-collapsed:${orgSlug}/${projectKey}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Private mode / blocked storage — start expanded.
    }
  }, [storageKey]);

  const save = (next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
    } catch {
      // Not persisted this session.
    }
  };

  return {
    collapsed,
    toggle: (id: string) => {
      const next = new Set(collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
    },
    expandAll: () => save(new Set()),
    collapseAll: (parentIds: string[]) => save(new Set(parentIds)),
  };
}

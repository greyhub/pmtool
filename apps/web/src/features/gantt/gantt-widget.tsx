'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DependencyDto, TaskDto, DependencyType } from '@pmtool/shared-types';
import {
  useCreateDependency,
  useDeleteDependency,
  useDependencies,
  useTasks,
  useUpdateTaskById,
} from '@pmtool/api-client';
import {
  GanttChart,
  type GanttLinkChange,
  type GanttLinkCreate,
  type GanttLinkInput,
  type GanttLinkType,
  type GanttTaskInput,
} from '@pmtool/ui';
import { useRouter } from '../../i18n/navigation';

const DEPENDENCY_TYPE_TO_LINK_TYPE: Record<DependencyType, GanttLinkType> = {
  FINISH_TO_START: 'e2s',
  START_TO_START: 's2s',
  FINISH_TO_FINISH: 'e2e',
  START_TO_FINISH: 's2e',
};

const LINK_TYPE_TO_DEPENDENCY_TYPE: Record<GanttLinkType, DependencyType> = {
  e2s: 'FINISH_TO_START',
  s2s: 'START_TO_START',
  e2e: 'FINISH_TO_FINISH',
  s2e: 'START_TO_FINISH',
};

// A CSS color value per status, driving GanttChart's per-task bar recolor
// (packages/ui's GanttChart has no notion of TaskStatus — it just paints
// whatever `barColor` string it's given). Mirrors STATUS_VARIANT's
// semantics (task-badges.tsx) so a bar's color always matches its badge.
const STATUS_BAR_COLOR: Record<TaskDto['status'], string> = {
  TODO: 'var(--color-text-muted)',
  IN_PROGRESS: 'var(--color-info)',
  IN_REVIEW: 'var(--color-warning)',
  DONE: 'var(--color-success)',
  BLOCKED: 'var(--color-danger)',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toAssignees(task: TaskDto): { name: string; character: string }[] {
  return (task.assignees ?? []).map((a) => ({ name: a.fullName, character: a.mascotCharacter }));
}

export function GanttWidget({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('gantt');
  const router = useRouter();

  const { data: tasks, isLoading: tasksLoading, isError: tasksError } = useTasks(orgSlug, projectKey);
  const { data: dependencies, isLoading: depsLoading, isError: depsError } = useDependencies(orgSlug, projectKey);
  const updateTask = useUpdateTaskById(orgSlug, projectKey);
  const createDependency = useCreateDependency(orgSlug, projectKey);
  const deleteDependency = useDeleteDependency(orgSlug, projectKey);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout>>();

  const flashSaveStatus = (status: 'saved' | 'error') => {
    setSaveStatus(status);
    clearTimeout(saveStatusTimer.current);
    saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const ganttTasks = useMemo<GanttTaskInput[]>(() => {
    if (!tasks) return [];
    const childrenByParentId = new Map<string, TaskDto[]>();
    for (const tsk of tasks) {
      if (!tsk.parentTaskId) continue;
      const siblings = childrenByParentId.get(tsk.parentTaskId) ?? [];
      siblings.push(tsk);
      childrenByParentId.set(tsk.parentTaskId, siblings);
    }

    function taskDates(task: TaskDto): { start: Date; end: Date } {
      const start = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
      let end = task.dueDate
        ? new Date(task.dueDate)
        : new Date(start.getTime() + Math.max(1, task.estimateHours ? task.estimateHours / 8 : 1) * DAY_MS);
      if (end <= start) end = new Date(start.getTime() + DAY_MS);
      return { start, end };
    }

    return tasks.map((task) => {
      const children = childrenByParentId.get(task.id);
      let { start, end } = taskDates(task);
      let type: GanttTaskInput['type'] = 'task';

      if (children && children.length > 0) {
        type = 'summary';
        // PRO-only `rollups` (auto date-derivation from children) is
        // hard-disabled in the installed free build, so a summary bar's
        // own span has to be computed by hand, spanning all its children.
        const childRanges = children.map(taskDates);
        start = new Date(Math.min(...childRanges.map((r) => r.start.getTime())));
        end = new Date(Math.max(...childRanges.map((r) => r.end.getTime())));
      } else if (task.startDate && task.dueDate && isSameCalendarDay(new Date(task.startDate), new Date(task.dueDate))) {
        type = 'milestone';
      }

      return {
        id: task.id,
        text: `${task.humanKey} ${task.title}`,
        start,
        end,
        parent: task.parentTaskId ?? undefined,
        type,
        barColor: STATUS_BAR_COLOR[task.status],
        progress: task.percentComplete,
        assignees: toAssignees(task),
      };
    });
  }, [tasks]);

  const ganttLinks = useMemo<GanttLinkInput[]>(
    () =>
      (dependencies ?? []).map((dep: DependencyDto) => ({
        id: dep.id,
        source: dep.predecessorId,
        target: dep.successorId,
        type: DEPENDENCY_TYPE_TO_LINK_TYPE[dep.type],
      })),
    [dependencies],
  );

  if (tasksLoading || depsLoading) {
    return <div className="h-96 animate-pulse rounded-lg border border-line bg-surface" />;
  }
  if (tasksError || depsError) {
    return (
      <p role="alert" className="p-6 text-sm text-danger">
        {t('loadError')}
      </p>
    );
  }
  if (!tasks || tasks.length === 0) {
    return <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>;
  }

  return (
    <div>
      {saveStatus === 'saved' && (
        <p role="status" className="mb-2 text-xs text-ink-secondary">
          {t('saved')}
        </p>
      )}
      {saveStatus === 'error' && (
        <p role="alert" className="mb-2 text-xs text-danger">
          {t('saveError')}
        </p>
      )}
      <GanttChart
        tasks={ganttTasks}
        links={ganttLinks}
        labels={{
          columnTask: t('columns.task'),
          columnAssignee: t('columns.assignee'),
          zoomDay: t('zoom.day'),
          zoomWeek: t('zoom.week'),
          zoomMonth: t('zoom.month'),
        }}
        onTaskUpdate={({ id, start, end }) => {
          if (!start && !end) return;
          updateTask.mutate(
            {
              taskId: id,
              input: {
                ...(start ? { startDate: start.toISOString() } : {}),
                ...(end ? { dueDate: end.toISOString() } : {}),
              },
            },
            {
              onSuccess: () => flashSaveStatus('saved'),
              onError: () => flashSaveStatus('error'),
            },
          );
        }}
        onTaskClick={(taskId) => {
          router.push(`/${orgSlug}/projects/${projectKey}/tasks/${taskId}`);
        }}
        onLinkAdd={(link: GanttLinkCreate) => {
          createDependency.mutate(
            {
              predecessorId: link.source,
              successorId: link.target,
              type: LINK_TYPE_TO_DEPENDENCY_TYPE[link.type],
              ...(link.lag ? { lagDays: link.lag } : {}),
            },
            {
              onError: () => flashSaveStatus('error'),
            },
          );
        }}
        onLinkDelete={(linkId) => {
          deleteDependency.mutate(linkId, {
            onError: () => flashSaveStatus('error'),
          });
        }}
        onLinkUpdate={(change: GanttLinkChange) => {
          // No update-dependency endpoint exists — implemented as delete-then-recreate.
          // Low-traffic path: update-link only fires from an Editor sidebar this screen doesn't render.
          const existing = (dependencies ?? []).find((dep) => dep.id === change.id);
          if (!existing) return;
          deleteDependency.mutate(existing.id, {
            onSuccess: () => {
              createDependency.mutate(
                {
                  predecessorId: change.source ?? existing.predecessorId,
                  successorId: change.target ?? existing.successorId,
                  type: change.type ? LINK_TYPE_TO_DEPENDENCY_TYPE[change.type] : existing.type,
                  ...(change.lag ? { lagDays: change.lag } : {}),
                },
                { onError: () => flashSaveStatus('error') },
              );
            },
            onError: () => flashSaveStatus('error'),
          });
        }}
      />
    </div>
  );
}

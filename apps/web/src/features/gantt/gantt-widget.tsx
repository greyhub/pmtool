'use client';

import { useMemo } from 'react';
import type { DependencyDto, TaskDto, DependencyType } from '@pmtool/shared-types';
import { useDependencies, useTasks, useUpdateTaskById } from '@pmtool/api-client';
import { GanttChart, type GanttLinkInput, type GanttLinkType, type GanttTaskInput } from '@pmtool/ui';

const DEPENDENCY_TYPE_TO_LINK_TYPE: Record<DependencyType, GanttLinkType> = {
  FINISH_TO_START: 'e2s',
  START_TO_START: 's2s',
  FINISH_TO_FINISH: 'e2e',
  START_TO_FINISH: 's2e',
};

const STATUS_PROGRESS: Record<TaskDto['status'], number> = {
  TODO: 0,
  IN_PROGRESS: 50,
  IN_REVIEW: 75,
  BLOCKED: 25,
  DONE: 100,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toGanttTask(task: TaskDto): GanttTaskInput {
  const start = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
  const end = task.dueDate
    ? new Date(task.dueDate)
    : new Date(start.getTime() + Math.max(1, task.estimateHours ? task.estimateHours / 8 : 1) * DAY_MS);

  return {
    id: task.id,
    text: `${task.humanKey} ${task.title}`,
    start,
    end: end > start ? end : new Date(start.getTime() + DAY_MS),
    progress: STATUS_PROGRESS[task.status],
    parent: task.parentTaskId ?? undefined,
  };
}

function toGanttLink(dep: DependencyDto): GanttLinkInput {
  return { id: dep.id, source: dep.predecessorId, target: dep.successorId, type: DEPENDENCY_TYPE_TO_LINK_TYPE[dep.type] };
}

export function GanttWidget({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const { data: tasks } = useTasks(orgSlug, projectKey);
  const { data: dependencies } = useDependencies(orgSlug, projectKey);
  const updateTask = useUpdateTaskById(orgSlug, projectKey);

  const ganttTasks = useMemo(() => (tasks ?? []).map(toGanttTask), [tasks]);
  const ganttLinks = useMemo(() => (dependencies ?? []).map(toGanttLink), [dependencies]);

  if (!tasks) return null;

  return (
    <GanttChart
      tasks={ganttTasks}
      links={ganttLinks}
      onTaskUpdate={({ id, start, end }) => {
        if (!start && !end) return;
        updateTask.mutate({
          taskId: id,
          input: {
            ...(start ? { startDate: start.toISOString() } : {}),
            ...(end ? { dueDate: end.toISOString() } : {}),
          },
        });
      }}
    />
  );
}

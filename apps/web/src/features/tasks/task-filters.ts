import type { TaskDto } from '@pmtool/shared-types';

export type AssigneeFilter = 'ALL' | 'ME' | 'NONE' | (string & {}); // or a user id

export interface TaskFilters {
  query: string;
  status: TaskDto['status'] | 'ALL';
  assignee: AssigneeFilter;
  hideDone: boolean;
}

export const NO_FILTERS: TaskFilters = {
  query: '',
  status: 'ALL',
  assignee: 'ALL',
  hideDone: false,
};

export function hasActiveFilters(f: TaskFilters): boolean {
  return f.query.trim() !== '' || f.status !== 'ALL' || f.assignee !== 'ALL' || f.hideDone;
}

/** Lowercase and strip Vietnamese diacritics so "thiet ke" finds "Thiết kế". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function matches(task: TaskDto, f: TaskFilters, meId: string | undefined): boolean {
  const q = fold(f.query.trim());
  if (q && !fold(`${task.humanKey} ${task.title}`).includes(q)) return false;
  if (f.status !== 'ALL' && task.status !== f.status) return false;
  if (f.hideDone && task.status === 'DONE') return false;
  if (f.assignee === 'NONE') return task.assignees.length === 0;
  if (f.assignee === 'ME') return !!meId && task.assignees.some((a) => a.id === meId);
  if (f.assignee !== 'ALL') return task.assignees.some((a) => a.id === f.assignee);
  return true;
}

/**
 * The tasks to show under a filter: every match plus its ancestors (so a
 * matching subtask still appears under its parent), in the original order.
 * `matchCount` counts real matches only, not the ancestors kept for context.
 */
export function filterTasks(
  tasks: TaskDto[],
  filters: TaskFilters,
  meId?: string,
): { tasks: TaskDto[]; matchCount: number } {
  if (!hasActiveFilters(filters)) return { tasks, matchCount: tasks.length };

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const keep = new Set<string>();
  let matchCount = 0;
  for (const task of tasks) {
    if (!matches(task, filters, meId)) continue;
    matchCount++;
    let cursor: TaskDto | undefined = task;
    while (cursor && !keep.has(cursor.id)) {
      keep.add(cursor.id);
      cursor = cursor.parentTaskId ? byId.get(cursor.parentTaskId) : undefined;
    }
  }
  return { tasks: tasks.filter((t) => keep.has(t.id)), matchCount };
}

export type DueState = 'overdue' | 'today' | 'soon' | 'normal' | 'done';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How urgent a due date is. Compared by UTC calendar day: due dates are
 * stored as noon-UTC instants (see lib/date-input.ts), so day arithmetic in
 * UTC is exact regardless of the viewer's timezone.
 */
export function dueState(dueIso: string | null, status: TaskDto['status'], now: Date = new Date()): DueState | null {
  if (!dueIso) return null;
  if (status === 'DONE') return 'done';
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(new Date(dueIso)) - startOfDay(now)) / DAY_MS);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 2) return 'soon';
  return 'normal';
}

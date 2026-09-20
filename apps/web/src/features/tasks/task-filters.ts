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

export type SortKey = 'DEFAULT' | 'DUE' | 'PRIORITY';
export type GroupKey = 'NONE' | 'STATUS';

const PRIORITY_RANK: Record<TaskDto['priority'], number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Reorders the flat list; because the tree is built by grouping this array by
 * parent (order-preserving), sorting it sorts the siblings at every level.
 * Undated tasks always sort last under DUE; ties keep their original order.
 */
export function sortTasks(tasks: TaskDto[], key: SortKey): TaskDto[] {
  if (key === 'DEFAULT') return tasks;
  const indexed = tasks.map((task, i) => ({ task, i }));
  indexed.sort((a, b) => {
    let diff = 0;
    if (key === 'PRIORITY') {
      diff = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
    } else {
      const da = a.task.dueDate ? Date.parse(a.task.dueDate) : Infinity;
      const db = b.task.dueDate ? Date.parse(b.task.dueDate) : Infinity;
      diff = da === db ? 0 : da < db ? -1 : 1;
    }
    return diff || a.i - b.i;
  });
  return indexed.map((x) => x.task);
}

/** Non-empty status buckets in workflow order. Subtasks are flattened into their own status bucket. */
export function groupByStatus(tasks: TaskDto[]): { status: TaskDto['status']; tasks: TaskDto[] }[] {
  const order: TaskDto['status'][] = ['IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'TODO', 'DONE'];
  return order
    .map((status) => ({
      status,
      tasks: tasks.filter((t) => t.status === status).map((t) => ({ ...t, parentTaskId: null })),
    }))
    .filter((g) => g.tasks.length > 0);
}

/** Tasks in the order the tree is displayed (each parent followed by its subtree), for previous/next navigation. */
export function treeOrder(tasks: TaskDto[]): TaskDto[] {
  const children = new Map<string | null, TaskDto[]>();
  for (const t of tasks) {
    const list = children.get(t.parentTaskId) ?? [];
    list.push(t);
    children.set(t.parentTaskId, list);
  }
  const out: TaskDto[] = [];
  const walk = (parent: string | null) => {
    for (const t of children.get(parent) ?? []) {
      out.push(t);
      walk(t.id);
    }
  };
  walk(null);
  return out;
}

export function neighbours(tasks: TaskDto[], id: string): { prev: TaskDto | null; next: TaskDto | null } {
  const ordered = treeOrder(tasks);
  const i = ordered.findIndex((t) => t.id === id);
  if (i === -1) return { prev: null, next: null };
  return { prev: ordered[i - 1] ?? null, next: ordered[i + 1] ?? null };
}

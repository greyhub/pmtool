import type { TaskDto } from '@pmtool/shared-types';

/** Children by parent id (null = top level), keeping the incoming order. */
export function groupByParent(tasks: TaskDto[]): Map<string | null, TaskDto[]> {
  const map = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const key = task.parentTaskId;
    const siblings = map.get(key) ?? [];
    siblings.push(task);
    map.set(key, siblings);
  }
  return map;
}

/** The visible rows in display order (depth-first, honouring collapsed parents), as one flat list. */
export function flattenVisible(
  roots: TaskDto[],
  grouped: Map<string | null, TaskDto[]>,
  collapsed: Set<string>,
  forceExpanded: boolean,
): { task: TaskDto; depth: number }[] {
  const out: { task: TaskDto; depth: number }[] = [];
  const walk = (task: TaskDto, depth: number) => {
    out.push({ task, depth });
    if (forceExpanded || !collapsed.has(task.id)) {
      for (const child of grouped.get(task.id) ?? []) walk(child, depth + 1);
    }
  };
  for (const r of roots) walk(r, 0);
  return out;
}

import { canContain, type TaskDto } from '@pmtool/shared-types';

export type DropZone = 'before' | 'after' | 'inside';

export interface MovePlan {
  parentTaskId: string | null;
  orderIndex: number;
}

/** Siblings in WBS order (the same order the codes are derived from). */
function siblingsOf(tasks: TaskDto[], parentId: string | null, excludeId: string): TaskDto[] {
  const ids = new Set(tasks.map((t) => t.id));
  return tasks
    .filter(
      (t) => t.id !== excludeId && (t.parentTaskId && ids.has(t.parentTaskId) ? t.parentTaskId : null) === parentId,
    )
    .sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
}

function isDescendant(tasks: TaskDto[], candidateId: string, ancestorId: string): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (let cur = byId.get(candidateId); cur?.parentTaskId; cur = byId.get(cur.parentTaskId)) {
    if (cur.parentTaskId === ancestorId) return true;
  }
  return false;
}

/**
 * Where a dragged task lands when dropped on `targetId`:
 *  - before / after: next to the target, under the target's parent;
 *  - inside: as the target's last child.
 * Returns null when the drop is not allowed (onto itself or its own subtree, or a
 * placement that breaks Phase > Deliverable > Work package > Activity).
 */
export function planMove(tasks: TaskDto[], dragId: string, targetId: string, zone: DropZone): MovePlan | null {
  const drag = tasks.find((t) => t.id === dragId);
  const target = tasks.find((t) => t.id === targetId);
  if (!drag || !target || drag.id === target.id) return null;
  if (isDescendant(tasks, target.id, drag.id)) return null;

  const ids = new Set(tasks.map((t) => t.id));
  const targetParentId = target.parentTaskId && ids.has(target.parentTaskId) ? target.parentTaskId : null;
  const parentId = zone === 'inside' ? target.id : targetParentId;
  const parent = parentId ? tasks.find((t) => t.id === parentId) : undefined;

  if (parent) {
    // An activity that receives a child becomes a work package (the API does the same).
    const effective = parent.nodeType === 'ACTIVITY' ? 'WORK_PACKAGE' : parent.nodeType;
    if (!canContain(effective, drag.nodeType)) return null;
  }

  const sibs = siblingsOf(tasks, parentId, drag.id);
  if (zone === 'inside') {
    const last = sibs[sibs.length - 1];
    return { parentTaskId: parentId, orderIndex: last ? last.orderIndex + 1 : 1 };
  }
  const at = sibs.findIndex((t) => t.id === target.id);
  if (zone === 'before') {
    const prev = sibs[at - 1];
    return {
      parentTaskId: parentId,
      orderIndex: prev ? (prev.orderIndex + target.orderIndex) / 2 : target.orderIndex - 1,
    };
  }
  const next = sibs[at + 1];
  return {
    parentTaskId: parentId,
    orderIndex: next ? (target.orderIndex + next.orderIndex) / 2 : target.orderIndex + 1,
  };
}

/** The neighbours a keyboard user can step past: previous/next sibling of a task. */
export function neighbourSiblings(tasks: TaskDto[], id: string): { prev: TaskDto | null; next: TaskDto | null } {
  const task = tasks.find((t) => t.id === id);
  if (!task) return { prev: null, next: null };
  const ids = new Set(tasks.map((t) => t.id));
  const parentId = task.parentTaskId && ids.has(task.parentTaskId) ? task.parentTaskId : null;
  const all = siblingsOf(tasks, parentId, '');
  const at = all.findIndex((t) => t.id === id);
  return { prev: all[at - 1] ?? null, next: all[at + 1] ?? null };
}

import {
  canContain,
  WBS_NODE_TYPES,
  WbsNodeType,
  wbsRank,
} from '@pmtool/shared-types';

export interface BulkTask {
  id: string;
  humanKey: string;
  parentTaskId: string | null;
  nodeType: WbsNodeType;
}

export interface BulkError {
  taskId: string;
  humanKey: string;
  message: string;
}

export interface BulkPlan {
  /** Final level of every task after the change. */
  final: Map<string, WbsNodeType>;
  /** Only the tasks whose level actually changes. */
  changes: Map<string, WbsNodeType>;
  errors: BulkError[];
}

const LABEL: Record<WbsNodeType, string> = {
  PHASE: 'Giai đoạn',
  DELIVERABLE: 'Giao phẩm',
  WORK_PACKAGE: 'Gói công việc',
  ACTIVITY: 'Hoạt động',
};

/**
 * Levels by position in the tree: leaves are activities, every parent sits one
 * level above its shallowest-typed child, and no parent is placed deeper than
 * its own depth. A tree deeper than four levels cannot be expressed and is reported.
 */
export function levelsByDepth(tasks: BulkTask[]): {
  levels: Map<string, WbsNodeType>;
  errors: BulkError[];
} {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const children = new Map<string, BulkTask[]>();
  for (const t of tasks) {
    if (t.parentTaskId && byId.has(t.parentTaskId)) {
      const list = children.get(t.parentTaskId) ?? [];
      list.push(t);
      children.set(t.parentTaskId, list);
    }
  }
  const depth = (t: BulkTask): number => {
    let d = 0;
    for (
      let cur = t;
      cur.parentTaskId && byId.has(cur.parentTaskId);
      cur = byId.get(cur.parentTaskId)!
    )
      d += 1;
    return d;
  };

  const rank = new Map<string, number>();
  const errors: BulkError[] = [];
  const visit = (t: BulkTask): number => {
    const kids = children.get(t.id) ?? [];
    let r: number;
    if (kids.length === 0)
      r = WBS_NODE_TYPES.length - 1; // leaf → ACTIVITY
    else r = Math.min(depth(t), Math.min(...kids.map(visit)) - 1);
    rank.set(t.id, r);
    return r;
  };
  for (const t of tasks)
    if (!t.parentTaskId || !byId.has(t.parentTaskId)) visit(t);

  const levels = new Map<string, WbsNodeType>();
  for (const t of tasks) {
    const r = rank.get(t.id);
    if (r === undefined || r < 0) {
      errors.push({
        taskId: t.id,
        humanKey: t.humanKey,
        message:
          'Nhánh này sâu quá 4 cấp (Giai đoạn › Giao phẩm › Gói công việc › Hoạt động) nên không gán tự động được',
      });
    } else {
      levels.set(t.id, WBS_NODE_TYPES[r]!);
    }
  }
  return { levels, errors };
}

/**
 * Validates a set of level changes as a whole. Only pairs that involve a changed
 * task are checked, so older data that already breaks the rules elsewhere does not block the change.
 */
export function planBulk(
  tasks: BulkTask[],
  wanted: Map<string, WbsNodeType>,
): BulkPlan {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const final = new Map(
    tasks.map((t) => [t.id, wanted.get(t.id) ?? t.nodeType]),
  );
  const changes = new Map<string, WbsNodeType>();
  for (const [id, type] of wanted)
    if (byId.get(id) && byId.get(id)!.nodeType !== type) changes.set(id, type);

  const errors: BulkError[] = [];
  for (const t of tasks) {
    const parent = t.parentTaskId ? byId.get(t.parentTaskId) : undefined;
    if (!parent) continue;
    if (!changes.has(t.id) && !changes.has(parent.id)) continue;
    const p = final.get(parent.id)!;
    const c = final.get(t.id)!;
    if (!canContain(p, c)) {
      errors.push({
        taskId: t.id,
        humanKey: t.humanKey,
        message: `${LABEL[c]} không thể nằm trong ${LABEL[p]} (${parent.humanKey})`,
      });
    }
  }
  return { final, changes, errors };
}

export function countLevels(
  final: Map<string, WbsNodeType>,
): Record<WbsNodeType, number> {
  const counts = Object.fromEntries(
    WBS_NODE_TYPES.map((t) => [t, 0]),
  ) as Record<WbsNodeType, number>;
  for (const t of final.values()) counts[t] += 1;
  return counts;
}

export { wbsRank };

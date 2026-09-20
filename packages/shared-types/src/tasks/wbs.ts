import { WBS_NODE_TYPES, type WbsNodeType } from '../common/enums';

/** 0 = highest level. A child must rank strictly lower (higher number) than its parent. */
export function wbsRank(type: WbsNodeType): number {
  return WBS_NODE_TYPES.indexOf(type);
}

/** Node types a child of `parent` may take (any type for a root task). */
export function legalChildTypes(parent: WbsNodeType | null): WbsNodeType[] {
  if (parent === null) return [...WBS_NODE_TYPES];
  return WBS_NODE_TYPES.filter((t) => wbsRank(t) > wbsRank(parent));
}

/** The natural default when adding a child under `parent`: the next level down. */
export function defaultChildType(parent: WbsNodeType | null): WbsNodeType {
  if (parent === null) return 'ACTIVITY';
  return WBS_NODE_TYPES[Math.min(wbsRank(parent) + 1, WBS_NODE_TYPES.length - 1)] ?? 'ACTIVITY';
}

export function canContain(parent: WbsNodeType, child: WbsNodeType): boolean {
  return wbsRank(child) > wbsRank(parent);
}

interface WbsCodeInput {
  id: string;
  parentTaskId: string | null;
  orderIndex: number;
}

/**
 * PMBOK WBS codes ("1", "1.2", "1.2.3"): position among siblings by orderIndex.
 * Derived, never stored, so drag-reorder can never leave stale codes.
 */
export function computeWbsCodes(tasks: WbsCodeInput[]): Map<string, string> {
  const ids = new Set(tasks.map((t) => t.id));
  const children = new Map<string | null, WbsCodeInput[]>();
  for (const t of tasks) {
    // An orphan (parent not in the list) is treated as a root.
    const key = t.parentTaskId && ids.has(t.parentTaskId) ? t.parentTaskId : null;
    const list = children.get(key) ?? [];
    list.push(t);
    children.set(key, list);
  }
  const codes = new Map<string, string>();
  const walk = (parentId: string | null, prefix: string) => {
    const list = (children.get(parentId) ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
    list.forEach((t, i) => {
      const code = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      codes.set(t.id, code);
      walk(t.id, code);
    });
  };
  walk(null, '');
  return codes;
}

import type { ScopeMapDto, ScopeMapNode } from '@pmtool/shared-types';

export const NODE_W = 172;
export const NODE_H = 42;
export const ROW_GAP = 10;
export const COL_GAP = 46;
export const PAD = 12;
export const HEADER_H = 26;

/** Column of the diagram each node kind lives in (0 = charter & scope). */
export const COLUMN_OF: Record<string, number> = {
  charter: 0,
  scope: 0,
  PHASE: 1,
  DELIVERABLE: 2,
  WORK_PACKAGE: 3,
  ACTIVITY: 4,
  milestone: 5,
};
export const COLUMN_COUNT = 6;

export interface PlacedNode {
  node: ScopeMapNode;
  col: number;
  x: number;
  y: number;
  /** Activities directly under this node that are currently folded away. */
  foldedActivities: number;
  /** Total activities directly under this node (folded or not). */
  activityCount: number;
  /** Sign-off records linked to this node: how many exist / how many are accepted. */
  records: { total: number; accepted: number };
}

export interface PlacedEdge {
  from: string;
  to: string;
  kind: 'contains' | 'produces' | 'depends';
}

export interface ScopeMapLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

const codeParts = (code: string | null) => (code ?? '').split('.').map((p) => Number(p) || 0);

function byCode(a: ScopeMapNode, b: ScopeMapNode): number {
  const pa = codeParts(a.code);
  const pb = codeParts(b.code);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export const colX = (col: number) => PAD + col * (NODE_W + COL_GAP);
export const rowY = (row: number) => PAD + HEADER_H + row * (NODE_H + ROW_GAP);

/**
 * Lays the WBS out as a left-to-right tree: one column per PMBOK level, one row
 * per visible element in WBS-code order. Activities stay folded into a counter
 * on their parent until that parent is in `expanded`, so a big project still
 * fits on screen.
 */
export function layoutScopeMap(map: ScopeMapDto, expanded: ReadonlySet<string>): ScopeMapLayout {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const children = new Map<string, ScopeMapNode[]>();
  const recordsOf = new Map<string, { total: number; accepted: number }>();

  for (const e of map.edges) {
    const child = byId.get(e.to);
    if (!child) continue;
    if (e.kind === 'contains') {
      const list = children.get(e.from) ?? [];
      list.push(child);
      children.set(e.from, list);
    } else if (e.kind === 'produces' && child.kind === 'deliverableRecord') {
      const r = recordsOf.get(e.from) ?? { total: 0, accepted: 0 };
      r.total += 1;
      if (child.status === 'ACCEPTED') r.accepted += 1;
      recordsOf.set(e.from, r);
    }
  }
  for (const list of Array.from(children.values())) list.sort(byCode);

  const placed: PlacedNode[] = [];
  let row = 0;
  const place = (node: ScopeMapNode) => {
    const kids = children.get(node.id) ?? [];
    const activities = kids.filter((k) => k.kind === 'ACTIVITY');
    const open = expanded.has(node.id);
    const col = COLUMN_OF[node.kind] ?? 4;
    placed.push({
      node,
      col,
      x: colX(col),
      y: rowY(row++),
      foldedActivities: open ? 0 : activities.length,
      activityCount: activities.length,
      records: recordsOf.get(node.id) ?? { total: 0, accepted: 0 },
    });
    for (const kid of kids) {
      if (kid.kind === 'ACTIVITY' && !open) continue;
      place(kid);
    }
  };

  const roots = children.get('scope') ?? [];
  const charter = byId.get('charter');
  const scope = byId.get('scope');
  for (const root of roots) {
    if (root.kind === 'ACTIVITY' && !expanded.has('scope')) continue;
    place(root);
  }

  const bodyRows = Math.max(row, 2);
  const fixed: PlacedNode[] = [];
  if (charter)
    fixed.push({
      node: charter,
      col: 0,
      x: colX(0),
      y: rowY(0),
      foldedActivities: 0,
      activityCount: 0,
      records: { total: 0, accepted: 0 },
    });
  if (scope)
    fixed.push({
      node: scope,
      col: 0,
      x: colX(0),
      y: rowY(1),
      foldedActivities: 0,
      activityCount: 0,
      records: { total: 0, accepted: 0 },
    });

  const all = [...fixed, ...placed];
  const visible = new Set(all.map((p) => p.node.id));
  const edges = map.edges
    .filter((e) => e.kind !== 'produces' || !byId.get(e.to) || byId.get(e.to)?.kind !== 'deliverableRecord')
    .filter((e) => visible.has(e.from) && visible.has(e.to));

  return {
    nodes: all,
    edges,
    width: colX(COLUMN_COUNT - 1) + NODE_W + PAD,
    height: rowY(bodyRows) + PAD,
  };
}

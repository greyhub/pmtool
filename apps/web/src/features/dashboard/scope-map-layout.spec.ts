import type { ScopeMapDto, ScopeMapNode } from '@pmtool/shared-types';
import { layoutScopeMap } from './scope-map-layout';

const node = (
  id: string,
  kind: ScopeMapNode['kind'],
  code: string | null,
  status: string | null = 'TODO',
): ScopeMapNode => ({
  id,
  kind,
  label: id,
  code,
  taskId: code ? id : null,
  status,
  progress: 0,
  hasDictionary: false,
});

const map: ScopeMapDto = {
  nodes: [
    node('charter', 'charter', null, 'APPROVED'),
    node('scope', 'scope', null, 'DRAFT'),
    node('p1', 'PHASE', '1'),
    node('p2', 'PHASE', '2'),
    node('d1', 'DELIVERABLE', '1.1'),
    node('w1', 'WORK_PACKAGE', '1.1.1'),
    node('a1', 'ACTIVITY', '1.1.1.1'),
    node('a2', 'ACTIVITY', '1.1.1.2'),
    node('m1', 'milestone', '2.1'),
    node('d:r1', 'deliverableRecord', null, 'ACCEPTED'),
  ],
  edges: [
    { from: 'charter', to: 'scope', kind: 'produces' },
    { from: 'scope', to: 'p1', kind: 'contains' },
    { from: 'scope', to: 'p2', kind: 'contains' },
    { from: 'p1', to: 'd1', kind: 'contains' },
    { from: 'd1', to: 'w1', kind: 'contains' },
    { from: 'w1', to: 'a1', kind: 'contains' },
    { from: 'w1', to: 'a2', kind: 'contains' },
    { from: 'p2', to: 'm1', kind: 'contains' },
    { from: 'd1', to: 'd:r1', kind: 'produces' },
    { from: 'a1', to: 'a2', kind: 'depends' },
  ],
  checks: [],
  scopeStatus: 'DRAFT',
  charterStatus: 'APPROVED',
  deliverableStatuses: { PLANNED: 0, IN_PROGRESS: 0, SUBMITTED: 0, ACCEPTED: 1, REJECTED: 0 },
};

const ids = (l: ReturnType<typeof layoutScopeMap>) => l.nodes.map((n) => n.node.id);

describe('layoutScopeMap', () => {
  it('folds activities into a counter on their parent', () => {
    const l = layoutScopeMap(map, new Set());
    expect(ids(l)).not.toContain('a1');
    const w1 = l.nodes.find((n) => n.node.id === 'w1');
    expect(w1?.foldedActivities).toBe(2);
    expect(w1?.activityCount).toBe(2);
  });

  it('shows activities once the parent is expanded, in WBS order, one row each', () => {
    const l = layoutScopeMap(map, new Set(['w1']));
    expect(ids(l)).toEqual(expect.arrayContaining(['a1', 'a2']));
    const y = (id: string) => l.nodes.find((n) => n.node.id === id)!.y;
    expect(y('a1')).toBeLessThan(y('a2'));
    expect(l.nodes.find((n) => n.node.id === 'w1')?.foldedActivities).toBe(0);
  });

  it('puts each level in its own column, left to right', () => {
    const l = layoutScopeMap(map, new Set(['w1']));
    const x = (id: string) => l.nodes.find((n) => n.node.id === id)!.x;
    expect(x('charter')).toBeLessThan(x('p1'));
    expect(x('p1')).toBeLessThan(x('d1'));
    expect(x('d1')).toBeLessThan(x('w1'));
    expect(x('w1')).toBeLessThan(x('a1'));
    expect(x('a1')).toBeLessThan(x('m1'));
  });

  it('rolls sign-off records into the deliverable instead of drawing them', () => {
    const l = layoutScopeMap(map, new Set());
    expect(ids(l)).not.toContain('d:r1');
    expect(l.nodes.find((n) => n.node.id === 'd1')?.records).toEqual({ total: 1, accepted: 1 });
  });

  it('keeps only edges between visible nodes', () => {
    const folded = layoutScopeMap(map, new Set());
    expect(folded.edges.some((e) => e.kind === 'depends')).toBe(false);
    const open = layoutScopeMap(map, new Set(['w1']));
    expect(open.edges.some((e) => e.kind === 'depends')).toBe(true);
  });
});

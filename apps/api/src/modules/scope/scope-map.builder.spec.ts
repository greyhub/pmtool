import { buildScopeMap, MapTask, ScopeMapInput } from './scope-map.builder';

const task = (over: Partial<MapTask> & { id: string }): MapTask => ({
  title: over.id,
  parentTaskId: null,
  nodeType: 'ACTIVITY',
  isMilestone: false,
  status: 'TODO',
  percentComplete: 0,
  orderIndex: 1,
  ...over,
});

const base = (over: Partial<ScopeMapInput>): ScopeMapInput => ({
  tasks: [],
  deliverables: [],
  dictionary: [],
  dependencies: [],
  charterStatus: null,
  scopeStatus: null,
  ...over,
});

const offenders = (map: ReturnType<typeof buildScopeMap>, key: string) =>
  map.checks.find((c) => c.key === key)?.offenders ?? [];

describe('buildScopeMap', () => {
  const tasks = [
    task({ id: 'ph', nodeType: 'PHASE' }),
    task({
      id: 'dl',
      nodeType: 'DELIVERABLE',
      parentTaskId: 'ph',
      orderIndex: 1,
    }),
    task({
      id: 'wp1',
      nodeType: 'WORK_PACKAGE',
      parentTaskId: 'dl',
      orderIndex: 1,
    }),
    task({
      id: 'wp2',
      nodeType: 'WORK_PACKAGE',
      parentTaskId: 'dl',
      orderIndex: 2,
    }),
    task({ id: 'a1', nodeType: 'ACTIVITY', parentTaskId: 'wp1' }),
    task({
      id: 'a2',
      nodeType: 'ACTIVITY',
      parentTaskId: 'wp1',
      orderIndex: 2,
    }),
    task({ id: 'ms', isMilestone: true, parentTaskId: 'ph', orderIndex: 2 }),
  ];

  it('links the chain and gives WBS codes', () => {
    const map = buildScopeMap(
      base({ tasks, charterStatus: 'APPROVED', scopeStatus: 'DRAFT' }),
    );
    expect(map.nodes.find((n) => n.id === 'wp2')?.code).toBe('1.1.2');
    expect(map.nodes.find((n) => n.id === 'ms')?.kind).toBe('milestone');
    expect(map.edges).toContainEqual({
      from: 'charter',
      to: 'scope',
      kind: 'produces',
    });
    expect(map.edges).toContainEqual({
      from: 'scope',
      to: 'ph',
      kind: 'contains',
    });
    expect(map.edges).toContainEqual({
      from: 'wp1',
      to: 'a1',
      kind: 'contains',
    });
  });

  it('flags work packages with no activity or dictionary entry', () => {
    const map = buildScopeMap(
      base({
        tasks,
        dictionary: [
          { taskId: 'wp1', hasContent: true, hasAcceptanceCriteria: false },
        ],
      }),
    );
    expect(offenders(map, 'workPackageWithoutActivity')).toEqual(['wp2']);
    expect(offenders(map, 'workPackageWithoutDictionary')).toEqual(['wp2']);
  });

  it('flags a deliverable node with no record and no criteria, and clears both when provided', () => {
    const bare = buildScopeMap(base({ tasks }));
    expect(offenders(bare, 'deliverableWithoutRecord')).toEqual(['dl']);
    expect(offenders(bare, 'deliverableWithoutCriteria')).toEqual(['dl']);

    const filled = buildScopeMap(
      base({
        tasks,
        deliverables: [
          {
            id: 'r1',
            name: 'Report',
            taskId: 'dl',
            status: 'PLANNED',
            acceptanceCriteria: 'Signed off',
          },
        ],
      }),
    );
    expect(offenders(filled, 'deliverableWithoutRecord')).toEqual([]);
    expect(offenders(filled, 'deliverableWithoutCriteria')).toEqual([]);
    expect(filled.edges).toContainEqual({
      from: 'dl',
      to: 'd:r1',
      kind: 'produces',
    });
    expect(filled.deliverableStatuses.PLANNED).toBe(1);
  });

  it('flags activities not under a work package', () => {
    const extra = [
      ...tasks,
      task({ id: 'loose', parentTaskId: 'ph', orderIndex: 3 }),
      task({ id: 'root-act', orderIndex: 9 }),
    ];
    const map = buildScopeMap(base({ tasks: extra }));
    expect(offenders(map, 'activityOutsideWorkPackage').sort()).toEqual([
      'loose',
      'root-act',
    ]);
  });

  it('a milestone is tied to a deliverable by a sign-off record or by closing a phase that has deliverables', () => {
    // 'ms' closes phase 'ph', which contains deliverable 'dl'.
    expect(
      offenders(buildScopeMap(base({ tasks })), 'milestoneWithoutDeliverable'),
    ).toEqual([]);

    const lonely = [
      ...tasks,
      task({ id: 'lonely', isMilestone: true, orderIndex: 8 }),
      task({ id: 'bare-phase', nodeType: 'PHASE', orderIndex: 7 }),
      task({ id: 'bare-ms', isMilestone: true, parentTaskId: 'bare-phase' }),
    ];
    const map = buildScopeMap(base({ tasks: lonely }));
    expect(offenders(map, 'milestoneWithoutDeliverable').sort()).toEqual([
      'bare-ms',
      'lonely',
    ]);

    const linked = buildScopeMap(
      base({
        tasks: lonely,
        deliverables: [
          {
            id: 'r9',
            name: 'Bàn giao',
            taskId: 'lonely',
            status: 'PLANNED',
            acceptanceCriteria: null,
          },
        ],
      }),
    );
    expect(offenders(linked, 'milestoneWithoutDeliverable')).toEqual([
      'bare-ms',
    ]);
  });

  it('hints at the 100% rule for a parent with a single child', () => {
    const map = buildScopeMap(
      base({
        tasks: [
          task({ id: 'p', nodeType: 'PHASE' }),
          task({ id: 'c', parentTaskId: 'p' }),
        ],
      }),
    );
    expect(offenders(map, 'singleChildParent')).toEqual(['p']);
  });

  it('keeps dependency edges between known tasks only', () => {
    const map = buildScopeMap(
      base({
        tasks,
        dependencies: [
          { predecessorId: 'a1', successorId: 'a2' },
          { predecessorId: 'a1', successorId: 'gone' },
        ],
      }),
    );
    expect(map.edges.filter((e) => e.kind === 'depends')).toEqual([
      { from: 'a1', to: 'a2', kind: 'depends' },
    ]);
  });
});

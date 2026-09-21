import { countLevels, levelsByDepth, planBulk, BulkTask } from './wbs-bulk';

const t = (
  id: string,
  parent: string | null,
  nodeType: BulkTask['nodeType'] = 'ACTIVITY',
): BulkTask => ({
  id,
  humanKey: `K-${id}`,
  parentTaskId: parent,
  nodeType,
});

describe('levelsByDepth', () => {
  it('gives root / child / grandchild / leaf the four levels', () => {
    const tasks = [t('p', null), t('d', 'p'), t('w', 'd'), t('a', 'w')];
    const { levels, errors } = levelsByDepth(tasks);
    expect(errors).toEqual([]);
    expect([...levels.entries()]).toEqual([
      ['p', 'PHASE'],
      ['d', 'DELIVERABLE'],
      ['w', 'WORK_PACKAGE'],
      ['a', 'ACTIVITY'],
    ]);
  });

  it('makes every leaf an activity and keeps parents strictly above their children', () => {
    // A shallow tree: root → leaf child. The root can only be a phase..work package above an activity.
    const shallow = levelsByDepth([t('r', null), t('c', 'r')]);
    expect(shallow.levels.get('c')).toBe('ACTIVITY');
    expect(shallow.levels.get('r')).toBe('PHASE');
    // A lone root task is a leaf: an activity.
    expect(levelsByDepth([t('solo', null)]).levels.get('solo')).toBe(
      'ACTIVITY',
    );
  });

  it('handles siblings of different depth', () => {
    const tasks = [t('p', null), t('a1', 'p'), t('d', 'p'), t('a2', 'd')];
    const { levels } = levelsByDepth(tasks);
    expect(levels.get('p')).toBe('PHASE');
    expect(levels.get('a1')).toBe('ACTIVITY');
    expect(levels.get('d')).toBe('DELIVERABLE');
    expect(levels.get('a2')).toBe('ACTIVITY');
  });

  it('reports a branch deeper than four levels instead of guessing', () => {
    const tasks = [
      t('1', null),
      t('2', '1'),
      t('3', '2'),
      t('4', '3'),
      t('5', '4'),
    ];
    const { errors } = levelsByDepth(tasks);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('sâu quá 4 cấp');
  });
});

describe('planBulk', () => {
  const tree = [
    t('p', null, 'PHASE'),
    t('d', 'p', 'DELIVERABLE'),
    t('w', 'd', 'WORK_PACKAGE'),
    t('a', 'w', 'ACTIVITY'),
  ];

  it('accepts a consistent change and reports what changes', () => {
    const plan = planBulk(
      tree,
      new Map([
        ['d', 'DELIVERABLE'],
        ['w', 'WORK_PACKAGE'],
        ['a', 'ACTIVITY'],
      ]),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.changes.size).toBe(0);
  });

  it('checks the change against parents and children, considering all changes together', () => {
    // Moving both the phase and the deliverable down to work package / activity is inconsistent with 'w'.
    const bad = planBulk(tree, new Map([['p', 'ACTIVITY']]));
    expect(bad.errors.map((e) => e.taskId)).toEqual(['d']);

    // Changing a parent and its children together in a consistent way is fine.
    const small = [
      t('p', null, 'PHASE'),
      t('d', 'p', 'DELIVERABLE'),
      t('a', 'd', 'ACTIVITY'),
    ];
    const ok = planBulk(
      small,
      new Map([
        ['p', 'DELIVERABLE'],
        ['d', 'WORK_PACKAGE'],
      ]),
    );
    expect(ok.errors).toEqual([]);
    expect(ok.changes.size).toBe(2);
  });

  it('does not block on unrelated existing violations', () => {
    const legacy = [
      t('p', null, 'ACTIVITY'),
      t('c', 'p', 'ACTIVITY'),
      t('x', null, 'PHASE'),
    ];
    const plan = planBulk(legacy, new Map([['x', 'DELIVERABLE']]));
    expect(plan.errors).toEqual([]);
  });

  it('counts the resulting levels', () => {
    const plan = planBulk(tree, new Map());
    expect(countLevels(plan.final)).toEqual({
      PHASE: 1,
      DELIVERABLE: 1,
      WORK_PACKAGE: 1,
      ACTIVITY: 1,
    });
  });
});

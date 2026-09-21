import {
  AUDITED,
  diffRows,
  keyOf,
  normalize,
  snapshotOf,
  touchesRecordedFields,
} from './history-diff';

describe('history diff', () => {
  it('reports only real changes, with before and after', () => {
    const d = diffRows(
      'RiskIssue',
      {
        id: 'r',
        title: 'Late vendor',
        status: 'IDENTIFIED',
        probability: 3,
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 'r',
        title: 'Late vendor',
        status: 'MITIGATING',
        probability: 3,
        updatedAt: new Date('2026-02-01'),
      },
    );
    expect(d).toEqual([
      { field: 'status', from: 'IDENTIFIED', to: 'MITIGATING' },
    ]);
  });

  it('treats equal dates and equal JSON as unchanged, whatever the object identity', () => {
    expect(
      diffRows(
        'RiskIssue',
        { dueDate: new Date('2026-03-01T00:00:00Z') },
        { dueDate: new Date('2026-03-01T00:00:00Z') },
      ),
    ).toEqual([]);
    expect(
      diffRows(
        'ProjectCharter',
        { purpose: { content: 'a' } },
        { purpose: { content: 'a' } },
      ),
    ).toEqual([]);
  });

  it('stores dates as ISO strings and cuts long text', () => {
    expect(normalize(new Date('2026-03-01T10:00:00Z'))).toBe(
      '2026-03-01T10:00:00.000Z',
    );
    const long = normalize('x'.repeat(500)) as string;
    expect(long).toHaveLength(301);
    expect(long.endsWith('…')).toBe(true);
    expect(normalize(undefined)).toBeNull();
    expect(normalize({ a: 1 })).toBe('{"a":1}');
  });

  it('keeps only the fact that a bulky field changed, never its text', () => {
    const d = diffRows(
      'Task',
      { description: { content: 'old secret text' }, title: 'T' },
      { description: { content: 'new secret text' }, title: 'T' },
    );
    expect(d).toEqual([{ field: 'description', changed: true }]);
  });

  it('ignores ordering and bookkeeping columns', () => {
    expect(
      diffRows(
        'Task',
        { orderIndex: 1, completedAt: null, title: 'T' },
        { orderIndex: 9, completedAt: new Date(), title: 'T' },
      ),
    ).toEqual([]);
    expect(
      diffRows('Project', { taskSequence: 1 }, { taskSequence: 2 }),
    ).toEqual([]);
  });

  it('does not claim a column changed when the query did not load it', () => {
    expect(
      diffRows('Task', { title: 'A', status: 'TODO' }, { title: 'A' }),
    ).toEqual([]);
    expect(
      diffRows('Task', { title: 'A' }, { title: 'A', status: 'DONE' }),
    ).toEqual([]);
  });

  it('snapshots a row for create/delete without ids, bulky text or empty values', () => {
    const snap = snapshotOf('Task', {
      id: 't',
      organizationId: 'o',
      title: 'Write docs',
      description: { content: 'long' },
      status: 'TODO',
      dueDate: null,
      orderIndex: 5,
    });
    expect(snap).toEqual({
      title: 'Write docs',
      description: '…',
      status: 'TODO',
    });
  });

  it('leaves out included relations and counts that a query result may carry', () => {
    const row = {
      id: 't',
      title: 'T',
      status: 'TODO',
      _count: { subtasks: 0 },
      assignees: [{ userId: 'u' }],
    };
    expect(snapshotOf('Task', row)).toEqual({ title: 'T', status: 'TODO' });
    expect(
      diffRows(
        'Task',
        { title: 'A', assignees: [] },
        { title: 'B', assignees: [{ userId: 'u' }], _count: { subtasks: 1 } },
      ),
    ).toEqual([{ field: 'title', from: 'A', to: 'B' }]);
  });

  it('knows when an update only moves bookkeeping columns (nothing to record, nothing to read)', () => {
    expect(
      touchesRecordedFields('Project', { taskSequence: { increment: 1 } }),
    ).toBe(false);
    expect(touchesRecordedFields('Task', { orderIndex: 5 })).toBe(false);
    expect(touchesRecordedFields('Task', { orderIndex: 5, title: 'x' })).toBe(
      true,
    );
    expect(touchesRecordedFields('Task', { status: 'DONE' })).toBe(true);
  });

  it('identifies rows by id, or task+user for assignments', () => {
    expect(keyOf('Task', { id: 'abc' })).toBe('abc');
    expect(
      keyOf('TaskAssignee', { taskId: 't1', userId: 'u1', role: 'PRIMARY' }),
    ).toBe('t1:u1');
  });

  it('audits the business entities but not accounts, tokens or generated data', () => {
    for (const m of [
      'Task',
      'RiskIssue',
      'Deliverable',
      'Stakeholder',
      'Sprint',
      'ProjectCharter',
      'Membership',
      'Project',
    ])
      expect(AUDITED[m]).toBeDefined();
    for (const m of [
      'User',
      'AuthToken',
      'RefreshToken',
      'Notification',
      'ProjectDailySnapshot',
      'ActivityLog',
      'EntityHistory',
    ])
      expect(AUDITED[m]).toBeUndefined();
  });
});

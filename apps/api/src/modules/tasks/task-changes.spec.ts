import { diffTask, TaskSnapshot } from './task-changes';

const base: TaskSnapshot = {
  title: 'Thiết kế',
  description: null,
  status: 'TODO',
  priority: 'MEDIUM',
  startDate: new Date('2026-09-20T12:00:00Z'),
  dueDate: new Date('2026-09-25T12:00:00Z'),
  percentComplete: 0,
  isMilestone: false,
  assignee: 'An',
  supporters: ['Bình'],
};

describe('diffTask', () => {
  it('reports nothing when nothing changed', () => {
    expect(diffTask(base, { ...base })).toEqual([]);
  });

  it('reports scalar changes with from/to', () => {
    const changes = diffTask(base, {
      ...base,
      status: 'DONE',
      percentComplete: 100,
    });
    expect(changes).toEqual([
      { field: 'status', from: 'TODO', to: 'DONE' },
      { field: 'percentComplete', from: 0, to: 100 },
    ]);
  });

  it('compares dates by instant, so an equal Date object is not a change', () => {
    expect(
      diffTask(base, { ...base, dueDate: new Date('2026-09-25T12:00:00Z') }),
    ).toEqual([]);
    expect(diffTask(base, { ...base, dueDate: null })).toEqual([
      { field: 'dueDate', from: '2026-09-25T12:00:00.000Z', to: null },
    ]);
  });

  it('reports a description edit without storing its text', () => {
    expect(diffTask(base, { ...base, description: 'Mô tả dài…' })).toEqual([
      { field: 'description' },
    ]);
    expect(
      diffTask({ ...base, description: '' }, { ...base, description: null }),
    ).toEqual([]);
  });

  it('reports assignee handover and supporter additions/removals', () => {
    expect(
      diffTask(base, { ...base, assignee: 'Chi', supporters: ['Dũng'] }),
    ).toEqual([
      { field: 'assignee', from: 'An', to: 'Chi' },
      { field: 'supporters', added: ['Dũng'], removed: ['Bình'] },
    ]);
  });
});

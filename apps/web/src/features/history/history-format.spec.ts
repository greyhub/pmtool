import { describe, expect, it } from 'vitest';
import { classifyValue, isOpaqueChange, snapshotHighlights } from './history-format';

describe('history formatting', () => {
  it('recognises what a stored value is', () => {
    expect(classifyValue('title', null)).toEqual({ kind: 'empty' });
    expect(classifyValue('title', '')).toEqual({ kind: 'empty' });
    expect(classifyValue('status', 'IN_PROGRESS')).toEqual({ kind: 'enum', token: 'IN_PROGRESS' });
    expect(classifyValue('dueDate', '2026-10-01T00:00:00.000Z')).toEqual({
      kind: 'date',
      date: '2026-10-01T00:00:00.000Z',
    });
    expect(classifyValue('isMilestone', true)).toEqual({ kind: 'boolean', value: true });
    expect(classifyValue('probability', 3)).toEqual({ kind: 'text', text: '3' });
    expect(classifyValue('title', 'Write the spec')).toEqual({
      kind: 'text',
      text: 'Write the spec',
    });
  });

  it('shows people by name but never an internal link as a raw id', () => {
    expect(classifyValue('ownerId', 'cmu123')).toEqual({ kind: 'person', id: 'cmu123' });
    expect(classifyValue('sprintId', 'cmu456')).toEqual({ kind: 'opaque' });
    expect(classifyValue('parentTaskId', 'cmu789')).toEqual({ kind: 'opaque' });
  });

  it('folds a change of internal links into a plain "changed"', () => {
    expect(isOpaqueChange({ field: 'sprintId', from: 'a', to: 'b' })).toBe(true);
    expect(isOpaqueChange({ field: 'status', from: 'TODO', to: 'DONE' })).toBe(false);
  });

  it('picks the fields worth showing for a created or deleted item', () => {
    const rows = snapshotHighlights({
      zzz: 'last',
      status: 'TODO',
      title: 'Login',
      description: '',
      sprintId: 'x',
      priority: 'HIGH',
    });
    expect(rows.map(([k]) => k)).toEqual(['title', 'status', 'priority', 'zzz']);
    expect(snapshotHighlights(null)).toEqual([]);
  });
});

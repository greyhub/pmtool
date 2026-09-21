import { describe, expect, it } from 'vitest';
import type { TaskDto } from '@pmtool/shared-types';
import { flattenVisible, groupByParent } from './tree-rows';

const t = (id: string, parentTaskId: string | null = null) => ({ id, parentTaskId }) as TaskDto;

describe('flattenVisible', () => {
  const tasks = [t('a'), t('a1', 'a'), t('a1x', 'a1'), t('a2', 'a'), t('b'), t('b1', 'b')];
  const grouped = groupByParent(tasks);
  const roots = grouped.get(null) ?? [];
  const ids = (rows: { task: TaskDto }[]) => rows.map((r) => r.task.id);

  it('lists rows depth-first with their depth', () => {
    const rows = flattenVisible(roots, grouped, new Set(), false);
    expect(ids(rows)).toEqual(['a', 'a1', 'a1x', 'a2', 'b', 'b1']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 1, 0, 1]);
  });

  it('hides the descendants of a collapsed parent but keeps the parent', () => {
    expect(ids(flattenVisible(roots, grouped, new Set(['a']), false))).toEqual(['a', 'b', 'b1']);
    expect(ids(flattenVisible(roots, grouped, new Set(['a1']), false))).toEqual([
      'a',
      'a1',
      'a2',
      'b',
      'b1',
    ]);
  });

  it('shows everything while filtering, whatever is collapsed', () => {
    expect(ids(flattenVisible(roots, grouped, new Set(['a', 'b']), true))).toHaveLength(6);
  });
});

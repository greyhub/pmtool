import { describe, expect, it } from 'vitest';
import { filterItems, fold, type PaletteItem } from './filter';

const item = (id: string, label: string, hint?: string): PaletteItem => ({ id, label, hint, group: 'g', href: `/${id}` });

describe('command palette filter', () => {
  it('folds Vietnamese diacritics', () => {
    expect(fold('Đăng nhập')).toBe('dang nhap');
  });

  it('finds items without typing diacritics, in any word order', () => {
    const items = [item('a', 'Đăng nhập'), item('b', 'Báo cáo')];
    expect(filterItems(items, 'dang nhap').map((i) => i.id)).toEqual(['a']);
    expect(filterItems(items, 'nhap dang').map((i) => i.id)).toEqual(['a']);
  });

  it('matches the hint (task key) but ranks label-prefix matches first', () => {
    const items = [item('a', 'Viết tài liệu', 'PRJ-12'), item('b', 'PRJ overview')];
    expect(filterItems(items, 'prj').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('returns the first items for an empty query and nothing for no match', () => {
    const items = [item('a', 'One'), item('b', 'Two')];
    expect(filterItems(items, '')).toHaveLength(2);
    expect(filterItems(items, 'zzz')).toEqual([]);
  });
});

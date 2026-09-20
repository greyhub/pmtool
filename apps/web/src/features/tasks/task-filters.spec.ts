import type { TaskDto } from '@pmtool/shared-types';
import {
  dueState,
  filterTasks,
  fold,
  groupByStatus,
  neighbours,
  NO_FILTERS,
  sortTasks,
  treeOrder,
} from './task-filters';
import { formatRelativeTime } from '../../lib/relative-time';

function task(id: string, over: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    humanKey: `T-${id}`,
    title: `Task ${id}`,
    status: 'TODO',
    parentTaskId: null,
    assignees: [],
    ...over,
  } as TaskDto;
}
const person = (id: string, role: 'PRIMARY' | 'SUPPORT' = 'PRIMARY') =>
  ({
    id,
    fullName: id,
    avatarUrl: null,
    mascotCharacter: 'fox',
    role,
  }) as TaskDto['assignees'][number];

describe('fold', () => {
  it('ignores case and Vietnamese diacritics', () => {
    expect(fold('Thiết kế Đăng nhập')).toBe('thiet ke dang nhap');
  });
});

describe('filterTasks', () => {
  const tasks = [
    task('1', { title: 'Thiết kế giao diện', status: 'IN_PROGRESS', assignees: [person('me')] }),
    task('2', {
      title: 'Trang chủ',
      parentTaskId: '1',
      status: 'DONE',
      assignees: [person('bob')],
    }),
    task('3', {
      title: 'Trang sản phẩm',
      parentTaskId: '1',
      status: 'TODO',
      assignees: [person('me', 'SUPPORT')],
    }),
    task('4', { title: 'Viết SEO', status: 'TODO' }),
  ];

  it('returns everything untouched when no filter is active', () => {
    const r = filterTasks(tasks, NO_FILTERS);
    expect(r.tasks).toBe(tasks);
    expect(r.matchCount).toBe(4);
  });

  it('searches title and key without caring about diacritics', () => {
    expect(filterTasks(tasks, { ...NO_FILTERS, query: 'thiet ke' }).tasks.map((t) => t.id)).toEqual(['1']);
    expect(filterTasks(tasks, { ...NO_FILTERS, query: 't-4' }).tasks.map((t) => t.id)).toEqual(['4']);
  });

  it('keeps the parent of a matching subtask for context, but counts only real matches', () => {
    const r = filterTasks(tasks, { ...NO_FILTERS, query: 'sản phẩm' });
    expect(r.tasks.map((t) => t.id)).toEqual(['1', '3']);
    expect(r.matchCount).toBe(1);
  });

  it('filters by status and hides done work', () => {
    expect(filterTasks(tasks, { ...NO_FILTERS, status: 'DONE' }).tasks.map((t) => t.id)).toEqual(['1', '2']);
    expect(filterTasks(tasks, { ...NO_FILTERS, hideDone: true }).matchCount).toBe(3);
  });

  it('"mine" includes tasks where I am a supporter, "none" finds unassigned, and a user id finds theirs', () => {
    expect(filterTasks(tasks, { ...NO_FILTERS, assignee: 'ME' }, 'me').tasks.map((t) => t.id)).toEqual(['1', '3']);
    expect(filterTasks(tasks, { ...NO_FILTERS, assignee: 'NONE' }).tasks.map((t) => t.id)).toEqual(['4']);
    expect(filterTasks(tasks, { ...NO_FILTERS, assignee: 'bob' }).tasks.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('"mine" matches nothing when the current user is unknown', () => {
    expect(filterTasks(tasks, { ...NO_FILTERS, assignee: 'ME' }, undefined).matchCount).toBe(0);
  });
});

describe('dueState', () => {
  const now = new Date('2026-09-20T05:00:00.000Z');
  it('classifies by calendar day', () => {
    expect(dueState('2026-09-19T12:00:00.000Z', 'TODO', now)).toBe('overdue');
    expect(dueState('2026-09-20T12:00:00.000Z', 'TODO', now)).toBe('today');
    expect(dueState('2026-09-22T12:00:00.000Z', 'TODO', now)).toBe('soon');
    expect(dueState('2026-09-30T12:00:00.000Z', 'TODO', now)).toBe('normal');
  });
  it('is never urgent for finished work, and null without a date', () => {
    expect(dueState('2026-09-01T12:00:00.000Z', 'DONE', now)).toBe('done');
    expect(dueState(null, 'TODO', now)).toBeNull();
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');
  it('speaks Vietnamese relative times', () => {
    expect(formatRelativeTime('2026-09-20T11:57:00.000Z', 'vi', now)).toBe('3 phút trước');
    expect(formatRelativeTime('2026-09-20T09:00:00.000Z', 'vi', now)).toBe('3 giờ trước');
    expect(formatRelativeTime('2026-09-19T12:00:00.000Z', 'vi', now)).toBe('Hôm qua');
  });
  it('handles sub-minute as "just now"', () => {
    expect(formatRelativeTime('2026-09-20T11:59:50.000Z', 'vi', now)).toMatch(/giây|bây giờ/i);
  });
});

describe('sortTasks', () => {
  const tasks = [
    task('a', { dueDate: '2026-09-30T12:00:00.000Z', priority: 'LOW' }),
    task('b', { dueDate: null, priority: 'CRITICAL' }),
    task('c', { dueDate: '2026-09-21T12:00:00.000Z', priority: 'HIGH' }),
    task('d', { dueDate: '2026-09-21T12:00:00.000Z', priority: 'HIGH' }),
  ];
  it('keeps the original order by default (same array)', () => {
    expect(sortTasks(tasks, 'DEFAULT')).toBe(tasks);
  });
  it('sorts by due date with undated last, keeping ties stable', () => {
    expect(sortTasks(tasks, 'DUE').map((t) => t.id)).toEqual(['c', 'd', 'a', 'b']);
  });
  it('sorts by priority, most urgent first', () => {
    expect(sortTasks(tasks, 'PRIORITY').map((t) => t.id)).toEqual(['b', 'c', 'd', 'a']);
  });
  it('does not mutate its input', () => {
    const copy = tasks.map((t) => t.id);
    sortTasks(tasks, 'DUE');
    expect(tasks.map((t) => t.id)).toEqual(copy);
  });
});

describe('groupByStatus', () => {
  it('returns only non-empty buckets in workflow order and flattens subtasks', () => {
    const groups = groupByStatus([
      task('1', { status: 'DONE' }),
      task('2', { status: 'IN_PROGRESS' }),
      task('3', { status: 'IN_PROGRESS', parentTaskId: '2' }),
    ]);
    expect(groups.map((g) => g.status)).toEqual(['IN_PROGRESS', 'DONE']);
    expect(groups[0]!.tasks.map((t) => [t.id, t.parentTaskId])).toEqual([
      ['2', null],
      ['3', null],
    ]);
  });
});

describe('treeOrder / neighbours', () => {
  const tasks = [task('1'), task('2'), task('3', { parentTaskId: '1' }), task('4', { parentTaskId: '3' })];
  it('lists each parent followed by its subtree', () => {
    expect(treeOrder(tasks).map((t) => t.id)).toEqual(['1', '3', '4', '2']);
  });
  it('finds the previous and next task as displayed', () => {
    expect(neighbours(tasks, '3')).toMatchObject({ prev: { id: '1' }, next: { id: '4' } });
    expect(neighbours(tasks, '1').prev).toBeNull();
    expect(neighbours(tasks, '2').next).toBeNull();
    expect(neighbours(tasks, 'nope')).toEqual({ prev: null, next: null });
  });
});

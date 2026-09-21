import type { TaskDto } from '@pmtool/shared-types';
import { neighbourSiblings, planMove } from './wbs-move';

const task = (id: string, parent: string | null, nodeType: TaskDto['nodeType'], orderIndex: number): TaskDto =>
  ({ id, parentTaskId: parent, nodeType, orderIndex, title: id, humanKey: id }) as unknown as TaskDto;

const tasks = [
  task('p1', null, 'PHASE', 10),
  task('p2', null, 'PHASE', 20),
  task('d1', 'p1', 'DELIVERABLE', 10),
  task('d2', 'p1', 'DELIVERABLE', 20),
  task('w1', 'd1', 'WORK_PACKAGE', 10),
  task('a1', 'w1', 'ACTIVITY', 10),
  task('a2', 'w1', 'ACTIVITY', 20),
];

describe('planMove', () => {
  it('places a task between two siblings', () => {
    expect(planMove(tasks, 'a2', 'a1', 'before')).toEqual({ parentTaskId: 'w1', orderIndex: 9 });
    expect(planMove(tasks, 'a1', 'a2', 'after')).toEqual({ parentTaskId: 'w1', orderIndex: 21 });
    // Between d1 (10) and d2 (20) under the same phase:
    expect(planMove([...tasks, task('d3', 'p1', 'DELIVERABLE', 30)], 'd3', 'd2', 'before')).toEqual({
      parentTaskId: 'p1',
      orderIndex: 15,
    });
  });

  it('moves under another parent when dropped inside it, as the last child', () => {
    expect(planMove(tasks, 'd2', 'p2', 'inside')).toEqual({ parentTaskId: 'p2', orderIndex: 1 });
    expect(planMove(tasks, 'a2', 'w1', 'inside')).toEqual({ parentTaskId: 'w1', orderIndex: 11 });
  });

  it('adopts the target parent when dropped before/after a task in another branch', () => {
    // An activity may sit directly under a phase, beside its deliverables.
    expect(planMove(tasks, 'a1', 'd2', 'after')).toEqual({ parentTaskId: 'p1', orderIndex: 21 });
  });

  it('refuses itself, its own subtree, and level violations', () => {
    expect(planMove(tasks, 'p1', 'p1', 'inside')).toBeNull();
    expect(planMove(tasks, 'p1', 'a1', 'inside')).toBeNull(); // into its own descendant
    expect(planMove(tasks, 'p1', 'd1', 'after')).toBeNull(); // would make a phase a child of a phase
    expect(planMove(tasks, 'd1', 'a1', 'inside')).toBeNull(); // a deliverable cannot go in an activity's subtree level
  });

  it('allows putting anything under an activity because it is promoted to a work package', () => {
    expect(planMove(tasks, 'a2', 'a1', 'inside')).toEqual({ parentTaskId: 'a1', orderIndex: 1 });
  });

  it('roots can be reordered among roots', () => {
    expect(planMove(tasks, 'p2', 'p1', 'before')).toEqual({ parentTaskId: null, orderIndex: 9 });
  });
});

describe('neighbourSiblings', () => {
  it('finds the previous and next sibling within the same parent', () => {
    expect(neighbourSiblings(tasks, 'd2')).toEqual({ prev: tasks[2], next: null });
    expect(neighbourSiblings(tasks, 'p1').next?.id).toBe('p2');
    expect(neighbourSiblings(tasks, 'a1').prev).toBeNull();
  });
});

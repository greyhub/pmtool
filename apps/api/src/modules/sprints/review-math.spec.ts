import {
  buildItems,
  byPerson,
  ReviewTask,
  summarize,
  velocityBefore,
} from './review-math';

const started = new Date('2026-10-01T00:00:00Z');
const task = (
  id: string,
  status: ReviewTask['status'],
  points: number | null,
  over: Partial<ReviewTask> = {},
): ReviewTask => ({
  id,
  humanKey: `T-${id}`,
  title: `Task ${id}`,
  status,
  storyPoints: points,
  estimateHours: 8,
  sprintAddedAt: new Date('2026-09-28T00:00:00Z'),
  assignee: { id: 'u1', name: 'An', character: 'fox' },
  ...over,
});

describe('sprint review math', () => {
  it('sizes items in the chosen unit and flags work added after the start', () => {
    const items = buildItems(
      [
        task('a', 'DONE', 5),
        task('b', 'TODO', null, {
          sprintAddedAt: new Date('2026-10-03T00:00:00Z'),
        }),
        task('c', 'DONE', 3, { sprintAddedAt: null }),
      ],
      'POINTS',
      started,
    );
    expect(items.map((i) => i.load)).toEqual([5, 0, 3]);
    expect(items.map((i) => i.addedMidSprint)).toEqual([false, true, false]);
    expect(buildItems([task('a', 'DONE', 5)], 'HOURS', started)[0]!.load).toBe(
      8,
    );
  });

  it('never calls anything mid-sprint when the sprint has no start', () => {
    expect(
      buildItems(
        [task('a', 'TODO', 1, { sprintAddedAt: new Date('2030-01-01') })],
        'POINTS',
        null,
      )[0]!.addedMidSprint,
    ).toBe(false);
  });

  it('summarises against everything that ended up planned', () => {
    const items = buildItems(
      [
        task('a', 'DONE', 5),
        task('b', 'DONE', 3, {
          sprintAddedAt: new Date('2026-10-03T00:00:00Z'),
        }),
        task('c', 'IN_PROGRESS', 2),
        task('d', 'BLOCKED', 0),
      ],
      'POINTS',
      started,
    );
    expect(summarize(items, 7)).toEqual({
      committed: 7,
      added: 3,
      finalPlanned: 10,
      completed: 8,
      unfinished: 2,
      completionPct: 80,
      doneCount: 2,
      unfinishedCount: 2,
      addedCount: 1,
    });
  });

  it('reads 0% (not NaN) for an empty sprint', () => {
    expect(summarize([], 0).completionPct).toBe(0);
  });

  it('adds up each person’s finished load, most first, and leaves out unassigned work', () => {
    const items = buildItems(
      [
        task('a', 'DONE', 5),
        task('b', 'DONE', 3, {
          assignee: { id: 'u2', name: 'Bình', character: 'cat' },
        }),
        task('c', 'TODO', 2, {
          assignee: { id: 'u2', name: 'Bình', character: 'cat' },
        }),
        task('d', 'DONE', 9, { assignee: null }),
      ],
      'POINTS',
      started,
    );
    const people = byPerson(items);
    expect(
      people.map((p) => [p.name, p.doneLoad, p.doneCount, p.unfinishedCount]),
    ).toEqual([
      ['An', 5, 1, 0],
      ['Bình', 3, 1, 1],
    ]);
  });

  it('averages the last three sprints before the current one', () => {
    const closed = [
      { id: 's1', completed: 10 },
      { id: 's2', completed: 20 },
      { id: 's3', completed: 30 },
      { id: 's4', completed: 40 },
      { id: 's5', completed: 50 },
    ];
    expect(velocityBefore(closed, 's5')).toBe(30); // (20 + 30 + 40) / 3
    expect(velocityBefore(closed, 's2')).toBe(10);
    expect(velocityBefore(closed, 's1')).toBeNull();
    expect(velocityBefore(closed, null)).toBe(40); // a running sprint compares with the last three closed ones: (30 + 40 + 50) / 3
  });
});

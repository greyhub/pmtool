import { describe, expect, it } from 'vitest';
import type { ReviewItemDto, SprintReviewDto } from '@pmtool/shared-types';
import { reviewToText, type ReviewTextLabels } from './review-text';

const labels: ReviewTextLabels = {
  title: 'Sprint review — S1',
  period: '1/10 → 14/10',
  goal: 'Goal',
  goalResult: { MET: 'Met', PARTIAL: 'Partly', MISSED: 'Missed', none: 'Not assessed' },
  summary: 'Summary',
  committed: 'Committed',
  completed: 'Completed',
  added: 'Added',
  unfinished: 'Unfinished',
  velocity: 'Average velocity',
  delivered: 'Delivered',
  left: 'Left over',
  people: 'People',
  notes: 'Notes',
  carriedSprint: (name) => `sprint ${name}`,
  carriedBacklog: 'backlog',
  addedTag: 'added',
  unit: 'points',
  preview: 'preview',
};

const item = (over: Partial<ReviewItemDto>): ReviewItemDto => ({
  id: 'i',
  humanKey: 'T-1',
  title: 'Login',
  status: 'DONE',
  load: 5,
  addedMidSprint: false,
  assignee: { id: 'u', name: 'An', character: 'fox' },
  carriedTo: null,
  ...over,
});

const review = (over: Partial<SprintReviewDto> = {}): SprintReviewDto => ({
  sprint: {
    id: 's',
    name: 'S1',
    goal: 'Ship login',
    status: 'CLOSED',
    startDate: '2026-10-01',
    endDate: '2026-10-14',
    closedAt: '2026-10-14T10:00:00Z',
  },
  unit: 'POINTS',
  isPreview: false,
  detailsAvailable: true,
  summary: {
    committed: 10,
    added: 3,
    finalPlanned: 13,
    completed: 8,
    unfinished: 5,
    completionPct: 62,
    doneCount: 1,
    unfinishedCount: 2,
    addedCount: 1,
  },
  delivered: [item({})],
  unfinished: [
    item({
      id: 'j',
      humanKey: 'T-2',
      title: 'Signup',
      status: 'IN_PROGRESS',
      load: 3,
      carriedTo: { kind: 'sprint', name: 'S2' },
    }),
    item({
      id: 'k',
      humanKey: 'T-3',
      title: 'Reset',
      status: 'TODO',
      load: 2,
      addedMidSprint: true,
      assignee: null,
      carriedTo: { kind: 'backlog', name: null },
    }),
  ],
  people: [
    { id: 'u', name: 'An', character: 'fox', doneLoad: 5, doneCount: 1, unfinishedCount: 1 },
  ],
  history: [],
  velocityAvg: 9.5,
  goalResult: 'PARTIAL',
  reviewNotes: 'Demo went well.',
  ...over,
});

describe('reviewToText', () => {
  it('writes the whole review as readable text', () => {
    const t = reviewToText(review(), labels);
    expect(t).toContain('# Sprint review — S1');
    expect(t).toContain('Goal: Ship login');
    expect(t).toContain('**Goal** → Partly');
    expect(t).toContain('- Completed: 8 / 13 points (62%)');
    expect(t).toContain('- Added: +3 points');
    expect(t).toContain('- Average velocity: 9.5 points');
    expect(t).toContain('- T-1 Login — 5 (An)');
    expect(t).toContain('- T-2 Signup — 3 (An) → sprint S2');
    expect(t).toContain('- T-3 Reset — 2 [added] → backlog');
    expect(t).toContain('- An: 5 points (1)');
    expect(t).toContain('## Notes\nDemo went well.');
  });

  it('leaves out what there is nothing to say about', () => {
    const t = reviewToText(
      review({
        sprint: { ...review().sprint, goal: null },
        goalResult: null,
        delivered: [],
        unfinished: [],
        people: [],
        reviewNotes: null,
        velocityAvg: null,
        summary: { ...review().summary, added: 0 },
      }),
      labels,
    );
    expect(t).toContain('**Goal** → Not assessed');
    expect(t).not.toContain('## Delivered');
    expect(t).not.toContain('## Left over');
    expect(t).not.toContain('## People');
    expect(t).not.toContain('## Notes');
    expect(t).not.toContain('Added:');
    expect(t).not.toContain('Average velocity');
  });

  it('marks a running sprint as a preview', () => {
    expect(reviewToText(review({ isPreview: true }), labels)).toContain('1/10 → 14/10 — preview');
  });
});

import { loadOf, totals } from './sprint-load';

const t = (
  status: string,
  storyPoints: number | null,
  estimateHours: number | null = null,
) => ({ status, storyPoints, estimateHours });

describe('sprint load', () => {
  it('measures in the chosen unit and treats unsized work as zero', () => {
    expect(loadOf(t('TODO', 5, 12), 'POINTS')).toBe(5);
    expect(loadOf(t('TODO', 5, 12), 'HOURS')).toBe(12);
    expect(loadOf(t('TODO', null, null), 'POINTS')).toBe(0);
  });

  it('totals planned vs done and counts', () => {
    const r = totals(
      [t('DONE', 3), t('DONE', 2), t('IN_PROGRESS', 8), t('TODO', null)],
      'POINTS',
    );
    expect(r).toEqual({
      plannedLoad: 13,
      doneLoad: 5,
      taskCount: 4,
      doneCount: 2,
    });
  });
});

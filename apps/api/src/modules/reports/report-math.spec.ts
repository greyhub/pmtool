import { DailySnapshotDto } from '@pmtool/shared-types';
import {
  addDaysKey,
  diffSnapshots,
  isDateKey,
  isWorthReporting,
  reportNotificationDetail,
} from './report-math';

const snap = (over: Partial<DailySnapshotDto> = {}): DailySnapshotDto => ({
  date: '2026-09-22',
  tasksTotal: 10,
  todo: 4,
  inProgress: 3,
  inReview: 0,
  done: 3,
  blocked: 0,
  overdue: 0,
  progressPct: 40,
  createdCount: 0,
  completedCount: 0,
  openRisks: 1,
  openIssues: 0,
  deliverablesTotal: 2,
  deliverablesAccepted: 1,
  milestonesTotal: 1,
  milestonesDone: 0,
  sprintPlanned: null,
  sprintDone: null,
  activityCount: 0,
  activeUsers: 0,
  ...over,
});

describe('report math', () => {
  it('shifts calendar days across month and year ends', () => {
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysKey('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('accepts only real calendar dates', () => {
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(isDateKey('nope')).toBe(false);
  });

  it('diffs each metric, and is empty when either side is missing', () => {
    const d = diffSnapshots(
      snap({ done: 5, overdue: 2, progressPct: 47.5 }),
      snap({ done: 3, overdue: 1, progressPct: 40 }),
    );
    expect(d).toMatchObject({ done: 2, overdue: 1, progressPct: 7.5 });
    expect(diffSnapshots(snap(), null)).toEqual({});
    expect(diffSnapshots(null, snap())).toEqual({});
  });

  it('reports a day with movement or late work, and stays quiet otherwise', () => {
    expect(isWorthReporting(snap({ activityCount: 3 }), null)).toBe(true);
    expect(isWorthReporting(snap({ completedCount: 1 }), null)).toBe(true);
    expect(isWorthReporting(snap({ overdue: 2 }), snap())).toBe(true);
    expect(isWorthReporting(snap(), snap())).toBe(false);
    expect(isWorthReporting(snap({ blocked: 1 }), snap({ blocked: 0 }))).toBe(
      true,
    );
  });

  it('encodes the notification payload with deltas only when there is a previous day', () => {
    const withPrev = JSON.parse(
      reportNotificationDetail(
        snap({ completedCount: 2, overdue: 3, progressPct: 50 }),
        snap({ overdue: 1, progressPct: 45 }),
      ),
    );
    expect(withPrev).toEqual({
      completed: 2,
      overdue: 3,
      overdueDelta: 2,
      progress: 50,
      progressDelta: 5,
    });
    const noPrev = JSON.parse(reportNotificationDetail(snap(), null));
    expect(noPrev.overdueDelta).toBeNull();
    expect(noPrev.progressDelta).toBeNull();
  });
});

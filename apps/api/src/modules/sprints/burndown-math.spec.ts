import { buildBurndown, BurndownInput } from './burndown-math';

const base = (over: Partial<BurndownInput> = {}): BurndownInput => ({
  startKey: '2026-10-01',
  endKey: '2026-10-05', // 5 days: ideal 20, 15, 10, 5, 0 for a commitment of 20
  todayKey: '2026-10-03',
  status: 'ACTIVE',
  committed: 20,
  closedKey: null,
  snapshots: [
    { date: '2026-10-01', planned: 20, done: 0 },
    { date: '2026-10-02', planned: 20, done: 5 },
    { date: '2026-10-03', planned: 20, done: 8 },
  ],
  ...over,
});

describe('burndown', () => {
  it('draws the ideal line evenly from the commitment to zero', () => {
    const r = buildBurndown(base());
    expect(r.days.map((d) => d.ideal)).toEqual([20, 15, 10, 5, 0]);
  });

  it('plots remaining work for days that happened and leaves future days empty', () => {
    const r = buildBurndown(base());
    expect(r.days.map((d) => d.remaining)).toEqual([20, 15, 12, null, null]);
    expect(r).toMatchObject({
      planned: 20,
      done: 8,
      remaining: 12,
      scopeChange: 0,
    });
  });

  it('says behind / on track / ahead against the ideal line with a 10% tolerance', () => {
    // today (day 3): ideal 10. Remaining 12 -> 2 over, within 10% of 20 = 2 -> on track.
    expect(buildBurndown(base()).pace.status).toBe('on_track');
    const behind = buildBurndown(
      base({
        snapshots: [
          { date: '2026-10-01', planned: 20, done: 0 },
          { date: '2026-10-03', planned: 20, done: 4 },
        ],
      }),
    );
    expect(behind.pace).toMatchObject({ status: 'behind', deltaVsIdeal: 6 });
    const ahead = buildBurndown(
      base({
        snapshots: [
          { date: '2026-10-01', planned: 20, done: 0 },
          { date: '2026-10-03', planned: 20, done: 15 },
        ],
      }),
    );
    expect(ahead.pace).toMatchObject({ status: 'ahead', deltaVsIdeal: -5 });
  });

  it('projects the end from the pace so far', () => {
    const r = buildBurndown(base()); // done 8 over 2 elapsed days = 4/day, 2 days left, remaining 12
    expect(r.pace).toMatchObject({ burnPerDay: 4, projectedRemainingAtEnd: 4 });
    const fast = buildBurndown(
      base({
        snapshots: [
          { date: '2026-10-01', planned: 20, done: 0 },
          { date: '2026-10-03', planned: 20, done: 20 },
        ],
      }),
    );
    expect(fast.pace.projectedRemainingAtEnd).toBe(0);
  });

  it('shows work added mid-sprint as a scope change (remaining can rise)', () => {
    const r = buildBurndown(
      base({
        snapshots: [
          { date: '2026-10-01', planned: 20, done: 0 },
          { date: '2026-10-02', planned: 26, done: 5 },
          { date: '2026-10-03', planned: 26, done: 8 },
        ],
      }),
    );
    expect(r.scopeChange).toBe(6);
    expect(r.days[1]!.remaining).toBe(21);
    expect(r.days[2]!.remaining).toBe(18);
  });

  it('carries the last known value over a missing night, flagged as estimated', () => {
    const r = buildBurndown(
      base({
        snapshots: [
          { date: '2026-10-01', planned: 20, done: 0 },
          { date: '2026-10-03', planned: 20, done: 8 },
        ],
      }),
    );
    expect(r.days[1]).toMatchObject({ remaining: 20, estimated: true });
    expect(r.days[2]).toMatchObject({ remaining: 12, estimated: false });
  });

  it('starts from the commitment when the first day has no snapshot at all', () => {
    const r = buildBurndown(
      base({ snapshots: [{ date: '2026-10-03', planned: 20, done: 8 }] }),
    );
    expect(r.days[0]).toMatchObject({ remaining: 20, estimated: true });
  });

  it('stops at the close day and reports the outcome', () => {
    const r = buildBurndown(
      base({
        status: 'CLOSED',
        todayKey: '2026-10-10',
        closedKey: '2026-10-04',
        snapshots: [
          { date: '2026-10-01', planned: 20, done: 0 },
          { date: '2026-10-04', planned: 20, done: 14 },
        ],
      }),
    );
    expect(r.pace.status).toBe('closed');
    expect(r.days.map((d) => d.remaining)).toEqual([20, 20, 20, 6, null]);
    expect(r.remaining).toBe(6);
  });

  it('keeps drawing an overdue active sprint past its end date', () => {
    const r = buildBurndown(
      base({
        todayKey: '2026-10-07',
        snapshots: [
          { date: '2026-10-01', planned: 20, done: 0 },
          { date: '2026-10-05', planned: 20, done: 15 },
          { date: '2026-10-07', planned: 20, done: 17 },
        ],
      }),
    );
    expect(r.days).toHaveLength(7);
    expect(r.pace.overrunDays).toBe(2);
    expect(r.days[6]!.ideal).toBe(0);
    expect(r.remaining).toBe(3);
  });

  it('has nothing to plot before a sprint starts', () => {
    const r = buildBurndown(
      base({
        status: 'PLANNED',
        committed: null,
        snapshots: [],
        todayKey: '2026-09-28',
      }),
    );
    expect(r.pace.status).toBe('not_started');
    expect(r.days.every((d) => d.remaining === null)).toBe(true);
  });
});

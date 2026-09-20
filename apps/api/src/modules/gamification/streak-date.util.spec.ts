import {
  vnDateKey,
  vnDayGap,
  vnDayRangeUtc,
  vnWeekRangeUtc,
  vnWeekStartKey,
} from './streak-date.util';

describe('vnDateKey', () => {
  it('rolls over to the next VN calendar day at 17:00 UTC (00:00 UTC+7)', () => {
    expect(vnDateKey(new Date('2026-03-10T16:59:59.000Z'))).toBe('2026-03-10');
    expect(vnDateKey(new Date('2026-03-10T17:00:00.000Z'))).toBe('2026-03-11');
  });

  it('treats 1am Hanoi time as still the same VN day, not the previous UTC day', () => {
    // 2026-03-11T01:00 +07:00 == 2026-03-10T18:00Z, which is UTC-day 03-10
    // but VN-day 03-11 — this is exactly the skew a plain-UTC boundary would get wrong.
    expect(vnDateKey(new Date('2026-03-10T18:00:00.000Z'))).toBe('2026-03-11');
  });
});

describe('vnDayGap', () => {
  it('is 0 for the same day', () => {
    expect(vnDayGap('2026-03-10', '2026-03-10')).toBe(0);
  });

  it('is 1 for consecutive days', () => {
    expect(vnDayGap('2026-03-10', '2026-03-11')).toBe(1);
  });

  it('is >1 for a larger gap', () => {
    expect(vnDayGap('2026-03-10', '2026-03-14')).toBe(4);
  });
});

describe('vnDayRangeUtc', () => {
  it('spans the 24 VN-local hours of the given date-key, expressed as UTC instants', () => {
    const { start, end } = vnDayRangeUtc('2026-03-10');
    expect(start.toISOString()).toBe('2026-03-09T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-10T17:00:00.000Z');
  });

  it('round-trips with vnDateKey: an instant inside the range keys back to the same day', () => {
    const { start, end } = vnDayRangeUtc('2026-03-10');
    expect(vnDateKey(start)).toBe('2026-03-10');
    expect(vnDateKey(new Date(end.getTime() - 1))).toBe('2026-03-10');
  });
});

describe('vnWeekStartKey', () => {
  it("resolves a mid-week Wednesday to that week's Monday", () => {
    // 2026-03-11T00:00Z is a Wednesday (see GanttChart.spec.tsx's identical fixture).
    expect(vnWeekStartKey(new Date('2026-03-11T00:00:00.000Z'))).toBe(
      '2026-03-09',
    );
  });

  it('resolves Monday itself to itself', () => {
    expect(vnWeekStartKey(new Date('2026-03-09T00:00:00.000Z'))).toBe(
      '2026-03-09',
    );
  });

  it('resolves Sunday to the preceding Monday, not the next one', () => {
    expect(vnWeekStartKey(new Date('2026-03-15T00:00:00.000Z'))).toBe(
      '2026-03-09',
    );
  });
});

describe('vnWeekRangeUtc', () => {
  it('spans exactly 7 VN-local days starting at the given Monday date-key', () => {
    const { start, end } = vnWeekRangeUtc('2026-03-09');
    expect(start.toISOString()).toBe('2026-03-08T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-15T17:00:00.000Z');
  });
});

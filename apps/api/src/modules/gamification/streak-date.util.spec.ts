import { vnDateKey, vnDayGap } from './streak-date.util';

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

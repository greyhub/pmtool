import { vnStartOfToday, vnStartOfTomorrow } from './due-date-window.util';

describe('vnStartOfToday / vnStartOfTomorrow', () => {
  it('returns the UTC instant of the most recent VN midnight, at the exact boundary', () => {
    // 2026-03-10T17:00:00Z is exactly 2026-03-11T00:00 +07:00 (VN midnight).
    const at = new Date('2026-03-10T17:00:00.000Z');
    expect(vnStartOfToday(at).toISOString()).toBe('2026-03-10T17:00:00.000Z');
  });

  it('returns the same VN midnight for any instant later that VN calendar day', () => {
    // 2026-03-11T10:30 +07:00 == 2026-03-11T03:30Z, still VN-day 03-11.
    const at = new Date('2026-03-11T03:30:00.000Z');
    expect(vnStartOfToday(at).toISOString()).toBe('2026-03-10T17:00:00.000Z');
  });

  it('rolls back to the previous VN midnight for an instant just before the boundary', () => {
    // 2026-03-10T23:59 +07:00 == 2026-03-10T16:59Z, still VN-day 03-10.
    const at = new Date('2026-03-10T16:59:00.000Z');
    expect(vnStartOfToday(at).toISOString()).toBe('2026-03-09T17:00:00.000Z');
  });

  it('vnStartOfTomorrow is exactly 24h after vnStartOfToday', () => {
    const at = new Date('2026-03-11T03:30:00.000Z');
    const today = vnStartOfToday(at).getTime();
    const tomorrow = vnStartOfTomorrow(at).getTime();
    expect(tomorrow - today).toBe(24 * 60 * 60 * 1000);
  });
});

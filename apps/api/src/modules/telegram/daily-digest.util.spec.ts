import { vnDigestDateKey, vnHour } from './daily-digest.util';

describe('vnHour', () => {
  it('returns 0 exactly at VN midnight', () => {
    // 2026-03-10T17:00:00Z is exactly 2026-03-11T00:00 +07:00.
    expect(vnHour(new Date('2026-03-10T17:00:00.000Z'))).toBe(0);
  });

  it('returns 23 just before VN midnight', () => {
    // 2026-03-10T23:59 +07:00 == 2026-03-10T16:59Z.
    expect(vnHour(new Date('2026-03-10T16:59:00.000Z'))).toBe(23);
  });

  it('returns 17 at VN 17:00 (the default digest hour)', () => {
    // 2026-03-11T17:00 +07:00 == 2026-03-11T10:00Z.
    expect(vnHour(new Date('2026-03-11T10:00:00.000Z'))).toBe(17);
  });

  it('rolls over correctly just after an hour boundary', () => {
    // 2026-03-11T17:00:01 +07:00 == 2026-03-11T10:00:01Z, still hour 17.
    expect(vnHour(new Date('2026-03-11T10:00:01.000Z'))).toBe(17);
    // 2026-03-11T18:00:00 +07:00 == 2026-03-11T11:00:00Z, now hour 18.
    expect(vnHour(new Date('2026-03-11T11:00:00.000Z'))).toBe(18);
  });
});

describe('vnDigestDateKey', () => {
  it('matches the VN calendar day, not the UTC one', () => {
    // 2026-03-11T03:30Z == 2026-03-11T10:30 +07:00, VN day is still 03-11.
    expect(vnDigestDateKey(new Date('2026-03-11T03:30:00.000Z'))).toBe(
      '2026-03-11',
    );
  });

  it('rolls to the previous VN day just before VN midnight', () => {
    // 2026-03-10T16:59Z == 2026-03-10T23:59 +07:00, VN day is still 03-10.
    expect(vnDigestDateKey(new Date('2026-03-10T16:59:00.000Z'))).toBe(
      '2026-03-10',
    );
  });

  it('rolls to the next VN day exactly at VN midnight', () => {
    expect(vnDigestDateKey(new Date('2026-03-10T17:00:00.000Z'))).toBe(
      '2026-03-11',
    );
  });
});

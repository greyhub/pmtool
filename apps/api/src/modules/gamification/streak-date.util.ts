const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh, UTC+7, hardcoded — no per-user timezone field exists yet.
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar-day key ("YYYY-MM-DD") in Asia/Ho_Chi_Minh for the given instant (defaults to now). */
export function vnDateKey(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + VN_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Whole-day gap between two VN calendar-day keys (b - a), e.g. 0 = same day, 1 = consecutive. */
export function vnDayGap(aKey: string, bKey: string): number {
  const a = Date.parse(`${aKey}T00:00:00Z`);
  const b = Date.parse(`${bKey}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export interface UtcRange {
  start: Date;
  end: Date;
}

/** UTC instant range [start, end) spanning one VN calendar day — the inverse of vnDateKey. */
export function vnDayRangeUtc(dateKey: string): UtcRange {
  const start = new Date(Date.parse(`${dateKey}T00:00:00Z`) - VN_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** The Monday date-key ("YYYY-MM-DD", VN calendar) of the ISO week containing the given instant — used as the periodKey for weekly quests instead of a full ISO week-number format. */
export function vnWeekStartKey(at: Date = new Date()): string {
  const todayKey = vnDateKey(at);
  const dayOfWeek = new Date(`${todayKey}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayMs =
    Date.parse(`${todayKey}T00:00:00Z`) - daysSinceMonday * DAY_MS;
  return new Date(mondayMs).toISOString().slice(0, 10);
}

/** UTC instant range [start, end) spanning the VN calendar week (Mon 00:00 through the following Mon 00:00) starting at the given Monday date-key. */
export function vnWeekRangeUtc(weekStartKey: string): UtcRange {
  const { start } = vnDayRangeUtc(weekStartKey);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

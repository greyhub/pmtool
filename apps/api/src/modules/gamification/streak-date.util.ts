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

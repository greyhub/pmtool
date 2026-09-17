// Same fixed Asia/Ho_Chi_Minh (UTC+7) assumption as
// apps/api/src/modules/gamification/streak-date.util.ts — no per-user
// timezone field exists yet, so this is a single global approximation.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 "today" in Asia/Ho_Chi_Minh, for the given instant (defaults to now). */
export function vnStartOfToday(at: Date = new Date()): Date {
  const shiftedMs = at.getTime() + VN_OFFSET_MS;
  const dayStartShiftedMs = Math.floor(shiftedMs / DAY_MS) * DAY_MS;
  return new Date(dayStartShiftedMs - VN_OFFSET_MS);
}

/** UTC instant of 00:00 "tomorrow" in Asia/Ho_Chi_Minh, for the given instant (defaults to now). */
export function vnStartOfTomorrow(at: Date = new Date()): Date {
  return new Date(vnStartOfToday(at).getTime() + DAY_MS);
}

// Third local copy of the same fixed Asia/Ho_Chi_Minh (UTC+7) assumption as
// due-date-window.util.ts and gamification/streak-date.util.ts — no
// per-user timezone field exists yet, so this is a single global
// approximation, duplicated rather than shared to avoid a cross-module
// import (see the "never import TasksModule/GamificationModule" rule in
// telegram.module.ts).
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Hour-of-day (0-23) in Asia/Ho_Chi_Minh, for the given instant (defaults to now). */
export function vnHour(at: Date = new Date()): number {
  const shifted = new Date(at.getTime() + VN_OFFSET_MS);
  return shifted.getUTCHours();
}

/** VN calendar-day key ("YYYY-MM-DD"), for the given instant (defaults to now). */
export function vnDigestDateKey(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + VN_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

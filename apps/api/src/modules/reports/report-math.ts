import {
  DailySnapshotDto,
  REPORT_METRICS,
  ReportMetricKey,
} from '@pmtool/shared-types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" shifted by whole days (calendar arithmetic, independent of time zone). */
export function addDaysKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function isDateKey(key: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(key) &&
    !Number.isNaN(Date.parse(`${key}T00:00:00Z`)) &&
    new Date(Date.parse(`${key}T00:00:00Z`)).toISOString().slice(0, 10) === key
  );
}

/** current - previous for every compared metric; empty when there is nothing to compare against. */
export function diffSnapshots(
  current: DailySnapshotDto | null,
  previous: DailySnapshotDto | null,
): Partial<Record<ReportMetricKey, number>> {
  if (!current || !previous) return {};
  const out: Partial<Record<ReportMetricKey, number>> = {};
  for (const { key } of REPORT_METRICS) {
    out[key] = Math.round((current[key] - previous[key]) * 10) / 10;
  }
  return out;
}

/**
 * Whether the morning summary is worth sending: something moved, or there is overdue work to chase.
 * A quiet day with nothing late stays quiet.
 */
export function isWorthReporting(
  current: DailySnapshotDto,
  previous: DailySnapshotDto | null,
): boolean {
  if (current.activityCount > 0 || current.completedCount > 0) return true;
  if (current.overdue > 0) return true;
  const d = diffSnapshots(current, previous);
  return (d.blocked ?? 0) !== 0;
}

/**
 * Compact, language-neutral payload for the in-app notification; the web app words it in the reader's language.
 */
export function reportNotificationDetail(
  current: DailySnapshotDto,
  previous: DailySnapshotDto | null,
): string {
  const d = diffSnapshots(current, previous);
  return JSON.stringify({
    completed: current.completedCount,
    overdue: current.overdue,
    overdueDelta: previous ? (d.overdue ?? 0) : null,
    progress: Math.round(current.progressPct),
    progressDelta: previous ? Math.round((d.progressPct ?? 0) * 10) / 10 : null,
  });
}

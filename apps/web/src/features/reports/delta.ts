import { REPORT_METRICS, type ReportMetricKey } from '@pmtool/shared-types';

export type DeltaTone = 'good' | 'bad' | 'neutral' | 'flat';

/** Colour a change by whether that direction is good for the metric ("overdue up" is bad, "done up" is good). */
export function deltaTone(key: ReportMetricKey, delta: number | undefined): DeltaTone {
  if (delta === undefined || delta === 0) return 'flat';
  const better = REPORT_METRICS.find((m) => m.key === key)?.better ?? 'neutral';
  if (better === 'neutral') return 'neutral';
  return (better === 'up') === delta > 0 ? 'good' : 'bad';
}

/** "+3", "-1.5", "0"; one decimal at most. */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded)}`;
}

/** The label for a "vs" choice: a date key N days before `date`. */
export function shiftDate(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

import type { SprintDto } from '@pmtool/shared-types';

/** Average completed load over the last `window` closed sprints; null until one has closed. */
export function velocityOf(sprints: SprintDto[], window = 3): number | null {
  const closed = sprints
    .filter((s) => s.status === 'CLOSED' && s.completedLoad != null)
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
    .slice(0, window);
  if (closed.length === 0) return null;
  return (
    Math.round((closed.reduce((sum, s) => sum + (s.completedLoad ?? 0), 0) / closed.length) * 10) /
    10
  );
}

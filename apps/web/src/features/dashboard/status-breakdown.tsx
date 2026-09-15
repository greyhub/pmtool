export function StatusBreakdown<S extends string>({
  counts,
  statuses,
  labelFor,
}: {
  counts: Record<S, number>;
  statuses: readonly S[];
  labelFor: (status: S) => string;
}) {
  const total = statuses.reduce((sum, s) => sum + counts[s], 0);

  return (
    <div className="flex flex-col gap-2">
      {statuses.map((status) => {
        const count = counts[status];
        const percent = total === 0 ? 0 : Math.round((count / total) * 100);
        return (
          <div key={status} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm text-ink-secondary">{labelFor(status)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
              <div className="h-full rounded-full bg-action-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-sm text-ink-primary">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

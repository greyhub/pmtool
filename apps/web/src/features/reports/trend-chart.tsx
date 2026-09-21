'use client';

import type { DailySnapshotDto } from '@pmtool/shared-types';

const W = 640;
const H = 180;
const PAD = { l: 36, r: 12, t: 12, b: 26 };

type Metric = 'progressPct' | 'done' | 'overdue' | 'openRisks';

/** Hand-drawn line chart of one metric over the snapshot days; theme colours only, so it works in dark mode. */
export function TrendChart({
  points,
  metric,
  label,
  highlightDate,
  locale,
}: {
  points: DailySnapshotDto[];
  metric: Metric;
  label: string;
  highlightDate: string;
  locale: string;
}) {
  if (points.length === 0) return null;
  const values = points.map((p) => p[metric]);
  const max = Math.max(...values, 1);
  const top = metric === 'progressPct' ? Math.max(100, max) : Math.ceil(max * 1.15);
  const x = (i: number) =>
    PAD.l +
    (points.length === 1
      ? (W - PAD.l - PAD.r) / 2
      : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`)
    .join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;
  const ticks = [0, top / 2, top];
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const every = Math.ceil(points.length / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-border-default)"
            strokeDasharray="3 4"
          />
          <text
            x={PAD.l - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--color-text-muted)"
          >
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--color-action-primary-bg)" opacity="0.14" />
      <path
        d={path}
        fill="none"
        stroke="var(--color-action-primary-bg)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle
            cx={x(i)}
            cy={y(p[metric])}
            r={p.date === highlightDate ? 5 : 3}
            fill={
              p.date === highlightDate ? 'var(--color-action-primary-bg)' : 'var(--color-surface)'
            }
            stroke="var(--color-action-primary-bg)"
            strokeWidth="2"
          >
            <title>{`${dayLabel(p.date)}: ${Math.round(p[metric] * 10) / 10}`}</title>
          </circle>
          {(i % every === 0 || i === points.length - 1) && (
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-text-muted)"
            >
              {dayLabel(p.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

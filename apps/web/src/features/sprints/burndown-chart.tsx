'use client';

import type { BurndownDto } from '@pmtool/shared-types';

const W = 680;
const H = 260;
const PAD = { l: 40, r: 16, t: 16, b: 30 };

/** Hand-drawn burndown: the ideal line (dashed), the real remaining work (solid), and where work was added along the way. Theme colours only. */
export function BurndownChart({
  data,
  locale,
  label,
  todayLabel,
}: {
  data: BurndownDto;
  locale: string;
  label: string;
  todayLabel: string;
}) {
  const days = data.days;
  const known = days.filter((d) => d.remaining !== null);
  const top = Math.max(
    1,
    data.committed ?? 0,
    ...days.map((d) => d.ideal),
    ...known.map((d) => d.remaining ?? 0),
    ...known.map((d) => d.planned ?? 0),
  );
  const yMax = Math.ceil(top * 1.1);
  const x = (i: number) =>
    PAD.l +
    (days.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (days.length - 1));
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const idealPath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.ideal).toFixed(1)}`)
    .join(' ');
  const actualPts = days.map((d, i) => ({ d, i })).filter(({ d }) => d.remaining !== null);
  const actualPath = actualPts
    .map(({ d, i }, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.remaining!).toFixed(1)}`)
    .join(' ');
  const todayIdx = days.findIndex((d) => d.date === data.today);
  const every = Math.ceil(days.length / 8);
  const ticks = [0, yMax / 2, yMax];
  // Days where the sprint's total grew: work was added.
  const scopeMarks = actualPts.filter(
    ({ d }, k) => k > 0 && (d.planned ?? 0) > (actualPts[k - 1]!.d.planned ?? 0),
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="h-auto w-full"
      data-testid="burndown-chart"
    >
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
      {todayIdx >= 0 && (
        <g>
          <line
            x1={x(todayIdx)}
            x2={x(todayIdx)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--color-text-muted)"
            strokeWidth="1"
            opacity="0.5"
          />
          <text
            x={x(todayIdx)}
            y={PAD.t - 4}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-text-muted)"
          >
            {todayLabel}
          </text>
        </g>
      )}
      <path
        d={idealPath}
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="2"
        strokeDasharray="6 5"
      />
      {actualPath && (
        <path
          d={actualPath}
          fill="none"
          stroke="var(--color-action-primary-bg)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {actualPts.map(({ d, i }) => (
        <circle
          key={d.date}
          cx={x(i)}
          cy={y(d.remaining!)}
          r={d.date === data.today ? 5 : 3.5}
          fill={d.estimated ? 'var(--color-surface)' : 'var(--color-action-primary-bg)'}
          stroke="var(--color-action-primary-bg)"
          strokeWidth="2"
        >
          <title>{`${fmtDay(d.date)}: ${d.remaining}`}</title>
        </circle>
      ))}
      {scopeMarks.map(({ d, i }) => (
        <text
          key={`s-${d.date}`}
          x={x(i)}
          y={y(d.remaining!) - 10}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="var(--color-warning)"
        >
          +
          {Math.round(
            ((d.planned ?? 0) -
              (actualPts[actualPts.findIndex((p) => p.d.date === d.date) - 1]?.d.planned ?? 0)) *
              10,
          ) / 10}
        </text>
      ))}
      {days.map((d, i) =>
        i % every === 0 || i === days.length - 1 ? (
          <text
            key={d.date}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-text-muted)"
          >
            {fmtDay(d.date)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

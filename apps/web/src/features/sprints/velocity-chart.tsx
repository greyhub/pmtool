'use client';

import type { SprintReviewDto } from '@pmtool/shared-types';

const W = 640;
const H = 220;
const PAD = { l: 36, r: 12, t: 12, b: 34 };

/** Committed vs completed per sprint as paired bars, with the average of the sprints before as a dashed line. Theme colours only. */
export function VelocityChart({
  history,
  average,
  label,
  committedLabel,
  completedLabel,
  averageLabel,
}: {
  history: SprintReviewDto['history'];
  average: number | null;
  label: string;
  committedLabel: string;
  completedLabel: string;
  averageLabel: string;
}) {
  if (history.length === 0) return null;
  const top = Math.max(1, average ?? 0, ...history.flatMap((h) => [h.committed, h.completed]));
  const yMax = Math.ceil(top * 1.15);
  const inner = W - PAD.l - PAD.r;
  const band = inner / history.length;
  const barW = Math.min(34, band / 3);
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
  const ticks = [0, yMax / 2, yMax];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="h-auto w-full"
        data-testid="velocity-chart"
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
        {history.map((h, i) => {
          const cx = PAD.l + band * i + band / 2;
          return (
            <g key={h.id}>
              <rect
                x={cx - barW - 2}
                y={y(h.committed)}
                width={barW}
                height={Math.max(0, H - PAD.b - y(h.committed))}
                rx="3"
                fill="var(--color-text-muted)"
                opacity={h.isCurrent ? 0.55 : 0.35}
              >
                <title>{`${h.name} — ${committedLabel}: ${h.committed}`}</title>
              </rect>
              <rect
                x={cx + 2}
                y={y(h.completed)}
                width={barW}
                height={Math.max(0, H - PAD.b - y(h.completed))}
                rx="3"
                fill="var(--color-action-primary-bg)"
                opacity={h.isCurrent ? 1 : 0.7}
              >
                <title>{`${h.name} — ${completedLabel}: ${h.completed}`}</title>
              </rect>
              <text
                x={cx}
                y={H - 14}
                textAnchor="middle"
                fontSize="11"
                fontWeight={h.isCurrent ? 700 : 400}
                fill={h.isCurrent ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}
              >
                {h.name.length > 12 ? `${h.name.slice(0, 11)}…` : h.name}
              </text>
            </g>
          );
        })}
        {average !== null && (
          <g>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(average)}
              y2={y(average)}
              stroke="var(--color-text-secondary)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x={PAD.l + 6}
              y={y(average) - 5}
              textAnchor="start"
              fontSize="11"
              fill="var(--color-text-secondary)"
            >
              {averageLabel}
            </text>
          </g>
        )}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm bg-ink-muted opacity-50"
          />{' '}
          {committedLabel}
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm bg-action-primary"
          />{' '}
          {completedLabel}
        </li>
      </ul>
    </div>
  );
}

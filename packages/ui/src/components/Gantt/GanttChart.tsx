'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
import type { IApi, IColumnConfig } from '@svar-ui/react-gantt';
import { useTheme } from 'next-themes';
import { Badge } from '../Badge/Badge';
import type { BadgeProps } from '../Badge/Badge';
import { cn } from '../../lib/cn';
import '@svar-ui/react-gantt/style.css';
import './gantt-theme.css';

export type GanttLinkType = 's2s' | 's2e' | 'e2s' | 'e2e';
export type GanttBadgeVariant = NonNullable<BadgeProps['variant']>;

export interface GanttTaskInput {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration?: number;
  progress?: number;
  parent?: string;
  type?: 'task' | 'summary' | 'milestone';
  /** CSS color value (e.g. `var(--color-success)`) used to recolor this task's bar/milestone. */
  barColor?: string;
  statusLabel?: string;
  statusVariant?: GanttBadgeVariant;
  priorityLabel?: string;
  priorityVariant?: GanttBadgeVariant;
  /** Rendered as small character-icon sprites (see `character-card.tsx`'s
   * identical technique), not text — relies on each org member having a
   * distinct `character` (enforced server-side) so the icon alone reliably
   * identifies who, without needing a name label in the narrow column. */
  assignees?: { name: string; character: string }[];
}

export interface GanttLinkInput {
  id: string;
  source: string;
  target: string;
  type: GanttLinkType;
}

export interface GanttTaskUpdate {
  id: string;
  start?: Date;
  end?: Date;
  progress?: number;
}

export interface GanttLinkCreate {
  /** The library's own temporary id for the just-drawn link, so a failed save can be rolled back via `delete-link`. */
  tempId: string;
  source: string;
  target: string;
  type: GanttLinkType;
  lag?: number;
}

export interface GanttLinkChange {
  id: string;
  source?: string;
  target?: string;
  type?: GanttLinkType;
  lag?: number;
}

export interface GanttLabels {
  columnTask: string;
  columnStart: string;
  columnDuration: string;
  columnStatus: string;
  columnPriority: string;
  columnAssignee: string;
  zoomDay: string;
  zoomWeek: string;
  zoomMonth: string;
}

export interface GanttChartProps {
  tasks: GanttTaskInput[];
  links: GanttLinkInput[];
  labels: GanttLabels;
  onTaskUpdate?: (update: GanttTaskUpdate) => void;
  onTaskClick?: (taskId: string) => void;
  onLinkAdd?: (link: GanttLinkCreate) => void;
  onLinkDelete?: (linkId: string) => void;
  onLinkUpdate?: (change: GanttLinkChange) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

type ScalePreset = { unit: 'year' | 'month' | 'week' | 'day'; step: number; format: string };

const SCALE_PRESETS: Record<ZoomLevel, ScalePreset[]> = {
  day: [
    { unit: 'month', step: 1, format: '%F %Y' },
    { unit: 'day', step: 1, format: '%j' },
  ],
  week: [
    { unit: 'month', step: 1, format: '%F %Y' },
    { unit: 'week', step: 1, format: '%W' },
  ],
  month: [
    { unit: 'year', step: 1, format: '%Y' },
    { unit: 'month', step: 1, format: '%M' },
  ],
};

// Every SVAR bar div carries both `data-id` and `data-task-id`, set to the
// task's id **prefixed with a literal colon** (e.g. `:cabc123`, confirmed
// live by inspecting the rendered DOM — not documented anywhere) — there is
// no documented per-task color prop, so this attribute-selector + CSS-
// custom-property override is the mechanism. Custom-property inheritance
// makes it cascade into milestone diamonds and summary bars too. Task ids
// are cuid strings (alphanumeric only), so no CSS-selector escaping beyond
// the colon prefix is needed.
/** Exported for unit testing. */
export function buildStatusColorCss(tasks: GanttTaskInput[]): string {
  return tasks
    .filter((t) => t.barColor)
    .map(
      (t) =>
        `.wx-bar[data-task-id=":${t.id}"]{--wx-gantt-task-color:${t.barColor};--wx-gantt-task-fill-color:${t.barColor};--wx-gantt-summary-color:${t.barColor};--wx-gantt-summary-fill-color:${t.barColor};--wx-gantt-milestone-color:${t.barColor};}`,
    )
    .join('\n');
}

/** Up to 2 character-icon sprites plus a "+N" tail. Exported so the cell renderer used inside `columns` stays unit-testable. */
export function AssigneeIcons({ assignees }: { assignees: { name: string; character: string }[] }) {
  if (assignees.length === 0) return <span className="text-ink-muted">—</span>;
  const shown = assignees.slice(0, 2);
  return (
    <span className="flex items-center gap-1">
      {shown.map((a, i) => (
        <span
          key={i}
          title={a.name}
          aria-label={a.name}
          className="h-5 w-5 shrink-0 rounded-full bg-surface-subtle"
          style={{
            backgroundImage: `url(/mascots/${a.character}-directions.webp)`,
            backgroundSize: '300% 300%',
            backgroundPosition: '50% 50%',
            backgroundRepeat: 'no-repeat',
          }}
        />
      ))}
      {assignees.length > shown.length && (
        <span className="text-xs text-ink-muted">+{assignees.length - shown.length}</span>
      )}
    </span>
  );
}

/** `DD/MM` — deliberately terser than the library's default `DD-MM-YYYY`; the year rarely matters at a glance in a project-scoped chart. Exported for unit testing. */
export function formatCompactDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Sum of configured column pixel widths. The library defaults to auto-sizing
 * the grid to a fraction of the container's width rather than this sum —
 * with 6 columns that left less room than the fixed-width columns alone
 * needed, squeezing the flexgrow task-name column to near zero and clipping
 * the assignee icons entirely (confirmed live via DOM inspection: `.wx-grid`
 * rendered at 491px against a 690px column-width sum). Passed as the
 * library's `gridWidth` prop to force it to match. Exported for unit testing.
 */
export function computeGridWidth(columns: IColumnConfig[]): number {
  return columns.reduce((sum, col) => sum + (col.width ?? 0), 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Exported for unit testing. `markers` (the documented "today line" API) is PRO-only and hard-disabled in the installed free build, so `highlightTime` is the real mechanism for both the today line and weekend shading. */
export function ganttHighlightTime(date: Date, unit: 'day' | 'hour', now: Date = new Date()): string {
  if (unit !== 'day') return '';
  if (isSameDay(date, now)) return 'pm-gantt-today';
  const day = date.getDay();
  if (day === 0 || day === 6) return 'wx-weekend';
  return '';
}

/**
 * Thin wrapper around @svar-ui/react-gantt (MIT) so app code never imports
 * the library directly — swapping the underlying Gantt implementation later
 * stays a one-file change. Only syncs a task change back via onTaskUpdate
 * once a drag/resize settles (`inProgress: false`), not on every
 * intermediate frame.
 *
 * The installed package is the free/MIT build: `DataStore.init()` in
 * `@svar-ui/gantt-store` unconditionally resets `markers`, `criticalPath`,
 * `wbs`, `rollups`, `baselines` and other PRO-only IConfig options on every
 * mount, regardless of what's passed in — confirmed by reading the compiled
 * source, not just the typings. Nothing here relies on those options.
 */
export function GanttChart({
  tasks,
  links,
  labels,
  onTaskUpdate,
  onTaskClick,
  onLinkAdd,
  onLinkDelete,
  onLinkUpdate,
}: GanttChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [narrow, setNarrow] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [tasks, mounted]);

  const columns = useMemo<IColumnConfig[]>(() => {
    const base: IColumnConfig[] = [
      {
        id: 'text',
        // This is the primary/tree column (it owns the expand/collapse
        // toggle) — giving it an { text, css } header config like the other
        // columns below replaces its default composite toggle+label
        // renderer with just the toggle icon and no label at all (verified
        // live). A plain string is the only header form that works
        // correctly here, so `labels.columnTask` is kept short by callers
        // (see gantt-widget.tsx) so it fits on one line without wrapping
        // into the next column instead of being truncated via CSS.
        header: labels.columnTask,
        flexgrow: 1,
        width: narrow ? 160 : 200,
        cell: ({ row }) => (
          <span className="block truncate" title={String(row.text ?? '')}>
            {row.text}
          </span>
        ),
      },
    ];
    if (narrow) return base;
    return [
      ...base,
      {
        id: 'start',
        header: { text: labels.columnStart, css: 'pm-gantt-header-nowrap' },
        width: 70,
        align: 'center',
        cell: ({ row }) => <span>{formatCompactDate(row.start)}</span>,
      },
      {
        id: 'duration',
        header: { text: labels.columnDuration, css: 'pm-gantt-header-nowrap' },
        width: 90,
        align: 'center',
      },
      {
        id: 'status',
        header: { text: labels.columnStatus, css: 'pm-gantt-header-nowrap' },
        width: 130,
        cell: ({ row }) =>
          row.statusLabel ? <Badge variant={row.statusVariant as GanttBadgeVariant}>{row.statusLabel}</Badge> : null,
      },
      {
        id: 'priority',
        header: { text: labels.columnPriority, css: 'pm-gantt-header-nowrap' },
        width: 110,
        cell: ({ row }) =>
          row.priorityLabel ? (
            <Badge variant={row.priorityVariant as GanttBadgeVariant}>{row.priorityLabel}</Badge>
          ) : null,
      },
      {
        id: 'assignee',
        header: { text: labels.columnAssignee, css: 'pm-gantt-header-nowrap' },
        width: 90,
        cell: ({ row }) => <AssigneeIcons assignees={(row.assignees ?? []) as { name: string; character: string }[]} />,
      },
    ];
  }, [labels, narrow]);

  const gridWidth = useMemo(() => computeGridWidth(columns), [columns]);

  if (!mounted) {
    return <div className="h-96 rounded-lg border border-line bg-surface" />;
  }

  function handleInit(api: IApi) {
    api.on('update-task', (ev) => {
      if (ev.inProgress) return;
      onTaskUpdate?.({ id: String(ev.id), start: ev.task.start, end: ev.task.end, progress: ev.task.progress });
    });
    api.on('select-task', (ev) => {
      onTaskClick?.(String(ev.id));
    });
    api.on('add-link', (ev) => {
      const link = ev.link;
      if (!link.source || !link.target || ev.id == null) return;
      onLinkAdd?.({
        tempId: String(ev.id),
        source: String(link.source),
        target: String(link.target),
        type: (link.type as GanttLinkType) ?? 'e2s',
        lag: link.lag,
      });
    });
    api.on('delete-link', (ev) => {
      onLinkDelete?.(String(ev.id));
    });
    api.on('update-link', (ev) => {
      const link = ev.link;
      onLinkUpdate?.({
        id: String(ev.id),
        source: link.source != null ? String(link.source) : undefined,
        target: link.target != null ? String(link.target) : undefined,
        type: link.type as GanttLinkType | undefined,
        lag: link.lag,
      });
    });
  }

  const Skin = resolvedTheme === 'dark' ? WillowDark : Willow;
  const colorCss = buildStatusColorCss(tasks);

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-end gap-1">
        {(
          [
            ['day', labels.zoomDay],
            ['week', labels.zoomWeek],
            ['month', labels.zoomMonth],
          ] as [ZoomLevel, string][]
        ).map(([level, label]) => (
          <button
            key={level}
            type="button"
            onClick={() => setZoom(level)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              zoom === level
                ? 'bg-action-primary-bg text-ink-on-primary'
                : 'text-ink-secondary hover:bg-surface-subtle',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {colorCss && <style>{colorCss}</style>}
      <div className="relative w-full">
        <div
          className="w-full overflow-x-auto overflow-y-hidden rounded-lg border border-line"
          ref={scrollRef}
        >
          <div style={{ minWidth: gridWidth + 200 }}>
            <Skin>
              <Gantt
                tasks={tasks}
                links={links}
                scales={SCALE_PRESETS[zoom]}
                columns={columns}
                gridWidth={gridWidth}
                highlightTime={ganttHighlightTime}
                init={handleInit}
              />
            </Skin>
          </div>
        </div>
        {canScrollRight && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-surface to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

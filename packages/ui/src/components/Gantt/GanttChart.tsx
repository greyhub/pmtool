'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
import type { IApi, IColumnConfig } from '@svar-ui/react-gantt';
import { useTheme } from 'next-themes';
import { cn } from '../../lib/cn';
import '@svar-ui/react-gantt/style.css';
import './gantt-theme.css';

export type GanttLinkType = 's2s' | 's2e' | 'e2s' | 'e2e';

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
  /** Summary rows only: whether the row is expanded. */
  open?: boolean;
  /** Rendered as small character-icon sprites (see `character-card.tsx`'s
   * identical technique), not text — relies on each org member having a
   * distinct `character` (enforced server-side) so the icon alone reliably
   * identifies who, without needing a name label in the narrow column. */
  assignees?: GanttAssignee[];
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
  columnAssignee: string;
  roleLabels?: { primary: string; support: string };
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
/**
 * Fades the NOT-yet-done part of a bar: a translucent white wash over the
 * remainder, so the finished part keeps the full status color. Drawn as the
 * bar's own background-image because the library's built-in progress fill
 * gets painted over the label and fades the title; a background is always
 * beneath the text. Milestones have no duration to fill, so are left alone.
 */
function progressWash(progress: number | undefined, type: GanttTaskInput['type']): string {
  if (type === 'milestone') return '';
  const pct = Math.min(100, Math.max(0, Math.round(progress ?? 0)));
  if (pct === 100) return '';
  return `background-image:linear-gradient(to right, transparent ${pct}%, rgba(255,255,255,0.55) ${pct}%);`;
}

/** Exported for unit testing. */
export function buildStatusColorCss(tasks: GanttTaskInput[]): string {
  return tasks
    .filter((t) => t.barColor)
    .map(
      (t) =>
        `.wx-bar[data-task-id=":${t.id}"]{--wx-gantt-task-color:${t.barColor};--wx-gantt-task-fill-color:transparent;--wx-gantt-summary-color:${t.barColor};--wx-gantt-summary-fill-color:transparent;--wx-gantt-milestone-color:${t.barColor};${progressWash(t.progress, t.type)}}`,
    )
    .join('\n');
}

export interface GanttAssignee {
  name: string;
  character: string;
  /** PRIMARY = the one accountable person, SUPPORT = helping. Missing counts as SUPPORT. */
  role?: 'PRIMARY' | 'SUPPORT';
}

/**
 * Cell index (0-8) in a character's 3x3 `-directions` sprite sheet — the same
 * layout page-mascot uses: up-left, up, up-right / left, center, right /
 * down-left, down, down-right. `dx`/`dy` point from the icon to the cursor;
 * inside the dead zone the character looks straight ahead. Exported for
 * unit testing.
 */
const CLOCKWISE_CELLS = [5, 8, 7, 6, 3, 0, 1, 2]; // right, down-right, down, down-left, left, up-left, up, up-right
export function aimCell(dx: number, dy: number, deadZone = 14): number {
  if (Math.hypot(dx, dy) < deadZone) return 4;
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return CLOCKWISE_CELLS[(sector + 8) % 8] ?? 4;
}

// One window listener shared by every icon (a chart can hold dozens), coalesced
// to one update per frame.
const pointerSubscribers = new Set<(x: number, y: number) => void>();
let lastPointer: { x: number; y: number } | null = null;
let pointerFrame = 0;
function onPointerMove(e: PointerEvent) {
  lastPointer = { x: e.clientX, y: e.clientY };
  schedulePointerNotify();
}
function schedulePointerNotify() {
  if (pointerFrame || !lastPointer) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    const p = lastPointer;
    if (p) pointerSubscribers.forEach((fn) => fn(p.x, p.y));
  });
}
function subscribePointer(fn: (x: number, y: number) => void): () => void {
  if (pointerSubscribers.size === 0) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    // Capture: the chart scrolls inside its own containers, which don't bubble to window.
    window.addEventListener('scroll', schedulePointerNotify, { passive: true, capture: true });
  }
  pointerSubscribers.add(fn);
  return () => {
    pointerSubscribers.delete(fn);
    if (pointerSubscribers.size === 0) {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', schedulePointerNotify, { capture: true });
    }
  };
}

function CharacterIcon({
  a,
  title,
  primary,
}: {
  a: GanttAssignee;
  title: string;
  primary: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cell, setCell] = useState(4);
  // Viewport position of the icon while hovered/focused; null = tooltip hidden.
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const showTip = () => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setTip({ x: box.left + box.width / 2, y: box.top });
  };

  useEffect(() => {
    // Touch-only devices have no cursor to follow.
    if (
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      return;
    }
    return subscribePointer((x, y) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      setCell(aimCell(x - (box.left + box.width / 2), y - (box.top + box.height / 2)));
    });
  }, []);

  return (
    <>
      <span
        ref={ref}
        aria-label={title}
        tabIndex={0}
        onPointerEnter={showTip}
        onPointerLeave={() => setTip(null)}
        onFocus={showTip}
        onBlur={() => setTip(null)}
        className={cn(
          'shrink-0 rounded-full bg-surface-subtle',
          primary ? 'h-10 w-10' : 'h-7 w-7 opacity-70',
        )}
        style={{
          backgroundImage: `url(/mascots/${a.character}-directions.webp)`,
          backgroundSize: '300% 300%',
          // background-size 300% makes each sprite cell a clean 0/50/100% step on both axes.
          backgroundPosition: `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 50}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
      {tip &&
        // Portaled: the grid cell clips overflow, which would cut the tooltip off.
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink-primary px-2 py-1 text-xs font-medium text-surface shadow-lg"
            style={{ left: tip.x, top: tip.y - 6 }}
          >
            {title}
          </span>,
          document.body,
        )}
    </>
  );
}

/**
 * The accountable person as a larger character icon, then supporters
 * as smaller, dimmer ones — at most 2 icons in total plus a "+N" tail.
 * `roleLabels` (optional) is appended to each icon's tooltip. Exported so the
 * cell renderer used inside `columns` stays unit-testable.
 */
export function AssigneeIcons({
  assignees,
  roleLabels,
}: {
  assignees: GanttAssignee[];
  roleLabels?: { primary: string; support: string };
}) {
  if (assignees.length === 0) return <span className="text-ink-muted">—</span>;
  const ordered = [
    ...assignees.filter((a) => a.role === 'PRIMARY'),
    ...assignees.filter((a) => a.role !== 'PRIMARY'),
  ];
  const shown = ordered.slice(0, 2);
  return (
    <span className="flex items-center gap-1.5">
      {shown.map((a, i) => {
        const primary = a.role === 'PRIMARY';
        const label = roleLabels ? roleLabels[primary ? 'primary' : 'support'] : '';
        return (
          <CharacterIcon
            key={i}
            a={a}
            primary={primary}
            title={label ? `${a.name} — ${label}` : a.name}
          />
        );
      })}
      {ordered.length > shown.length && (
        <span className="text-xs text-ink-muted">+{ordered.length - shown.length}</span>
      )}
    </span>
  );
}

/** Bar label: the title plus the completion percentage on the right, e.g. "PRG-2 Task        40%". */
function BarLabel({ data }: { data: { text?: string; progress?: number; type?: string } }) {
  const pct = Math.round(data.progress ?? 0);
  return (
    <span className="flex w-full items-center justify-between gap-2 px-1">
      <span className="truncate">{data.text}</span>
      {data.type !== 'milestone' && pct > 0 && (
        <span className="shrink-0 text-xs font-semibold opacity-80">{pct}%</span>
      )}
    </span>
  );
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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Exported for unit testing. `markers` (the documented "today line" API) is PRO-only and hard-disabled in the installed free build, so `highlightTime` is the real mechanism for both the today line and weekend shading. */
export function ganttHighlightTime(
  date: Date,
  unit: 'day' | 'hour',
  now: Date = new Date(),
): string {
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
  // Which parent rows the user has expanded. Saving a task refetches the list, and
  // the library rebuilds its tree from scratch (all collapsed) — so the open state
  // is kept here and fed back into the data instead of living only in the library.
  const openIds = useRef<Set<string>>(new Set());

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
    // Start/duration/status/priority used to each get their own grid column,
    // but that repeated on the chart itself: status is already the bar's
    // color, priority already a badge on the task detail page, and
    // start/duration are already the bar's position/length on the same row.
    // Keeping them here was the "too much detail, not enough color" the
    // Gantt was reworked to move away from — the grid now only carries what
    // the chart can't show: the task name and who's on it.
    return [
      ...base,
      {
        id: 'assignee',
        header: { text: labels.columnAssignee, css: 'pm-gantt-header-nowrap' },
        width: 150,
        cell: ({ row }) => (
          <AssigneeIcons
            assignees={(row.assignees ?? []) as GanttAssignee[]}
            roleLabels={labels.roleLabels}
          />
        ),
      },
    ];
  }, [labels, narrow]);

  const tasksWithOpen = useMemo(
    () => tasks.map((t) => (t.type === 'summary' ? { ...t, open: openIds.current.has(t.id) } : t)),
    [tasks],
  );

  const gridWidth = useMemo(() => computeGridWidth(columns), [columns]);

  if (!mounted) {
    return <div className="h-96 rounded-lg border border-line bg-surface" />;
  }

  function handleInit(api: IApi) {
    api.on('update-task', (ev) => {
      if (ev.inProgress) return;
      onTaskUpdate?.({
        id: String(ev.id),
        start: ev.task.start,
        end: ev.task.end,
        progress: ev.task.progress,
      });
    });
    api.on('open-task', (ev) => {
      if (ev.mode) openIds.current.add(String(ev.id));
      else openIds.current.delete(String(ev.id));
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
                tasks={tasksWithOpen}
                links={links}
                scales={SCALE_PRESETS[zoom]}
                columns={columns}
                gridWidth={gridWidth}
                cellHeight={52}
                taskTemplate={BarLabel}
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

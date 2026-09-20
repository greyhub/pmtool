'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useScopeMap } from '@pmtool/api-client';
import type { CoverageCheck, ScopeMapNode } from '@pmtool/shared-types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';
import { Link, useRouter } from '../../i18n/navigation';
import { COLUMN_COUNT, colX, HEADER_H, layoutScopeMap, NODE_H, NODE_W, PAD, type PlacedNode } from './scope-map-layout';

const BAR_W = 56;
const COLUMN_KEYS = [
  'colCharter',
  'colPhase',
  'colDeliverable',
  'colWorkPackage',
  'colActivity',
  'colMilestone',
] as const;

/** Status → SVG paint, all from theme tokens so both themes stay legible. */
function paint(node: ScopeMapNode): { fill: string; stroke: string } {
  if (node.kind === 'charter' || node.kind === 'scope') {
    return node.status === 'APPROVED'
      ? { fill: 'fill-success-bg', stroke: 'stroke-success' }
      : { fill: 'fill-surface-subtle', stroke: 'stroke-line-strong' };
  }
  if (node.status === 'DONE') return { fill: 'fill-success-bg', stroke: 'stroke-success' };
  if (node.status === 'IN_PROGRESS' || node.status === 'IN_REVIEW')
    return { fill: 'fill-info-bg', stroke: 'stroke-info' };
  if (node.status === 'BLOCKED') return { fill: 'fill-danger-bg', stroke: 'stroke-danger' };
  return { fill: 'fill-surface', stroke: 'stroke-line-strong' };
}

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(16, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function ScopeMap({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('dashboard.project.scopeMap');
  const router = useRouter();
  const { data: map } = useScopeMap(orgSlug, projectKey);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const layout = useMemo(() => (map ? layoutScopeMap(map, expanded) : null), [map, expanded]);
  const gaps = useMemo(() => {
    const set = new Set<string>();
    for (const c of map?.checks ?? []) for (const id of c.offenders) set.add(id);
    return set;
  }, [map]);

  if (!map || !layout) return null;

  const base = `/${orgSlug}/projects/${projectKey}`;
  const hrefOf = (n: ScopeMapNode) =>
    n.kind === 'charter'
      ? `${base}/charter`
      : n.kind === 'scope'
        ? `${base}/scope`
        : n.taskId
          ? `${base}/tasks/${n.taskId}`
          : base;
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandable = layout.nodes.filter((p) => p.activityCount > 0).map((p) => p.node.id);
  const hasWbs = map.nodes.some((n) => n.taskId);
  const at = new Map(layout.nodes.map((p) => [p.node.id, p]));
  const label = (n: ScopeMapNode) => (n.kind === 'charter' ? t('charter') : n.kind === 'scope' ? t('scope') : n.label);
  const nameOf = (id: string) => map.nodes.find((n) => n.id === id);

  const renderNode = (p: PlacedNode) => {
    const { node } = p;
    const { fill, stroke } = paint(node);
    const gap = gaps.has(node.id);
    const isMilestone = node.kind === 'milestone';
    const text = label(node);
    return (
      <g key={node.id} data-testid={`scope-node-${node.kind}`}>
        <g
          role="link"
          tabIndex={0}
          aria-label={`${node.code ? `${node.code} ` : ''}${text}`}
          className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-focus"
          onClick={() => router.push(hrefOf(node))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') router.push(hrefOf(node));
          }}
        >
          <title>{`${node.code ? `${node.code} · ` : ''}${text}`}</title>
          <rect
            x={p.x}
            y={p.y}
            width={NODE_W}
            height={NODE_H}
            rx={isMilestone ? 21 : 8}
            className={`${fill} ${gap ? 'stroke-warning' : stroke}`}
            strokeWidth={gap ? 2 : 1.25}
            strokeDasharray={gap ? '5 3' : undefined}
          />
          <text x={p.x + 10} y={p.y + 17} className="fill-ink-primary text-[11.5px] font-medium">
            {node.code ? <tspan className="fill-ink-muted font-mono text-[10px]">{node.code} </tspan> : null}
            {truncate(text, node.code ? 19 : 25)}
          </text>
          {node.progress !== null && (
            <>
              <rect
                x={p.x + 10}
                y={p.y + NODE_H - 11}
                width={BAR_W}
                height={4}
                rx={2}
                className="fill-line"
                opacity={0.6}
              />
              {node.progress > 0 && (
                <rect
                  x={p.x + 10}
                  y={p.y + NODE_H - 11}
                  width={BAR_W * (node.progress / 100)}
                  height={4}
                  rx={2}
                  className="fill-action-primary"
                />
              )}
              <text x={p.x + 10 + BAR_W + 5} y={p.y + NODE_H - 6.5} className="fill-ink-muted text-[9px] tabular-nums">
                {node.progress}%
              </text>
            </>
          )}
          {p.records.total > 0 && (
            <text x={p.x + NODE_W - 8} y={p.y + 17} textAnchor="end" className="fill-success text-[10px] font-semibold">
              ✓ {p.records.accepted}/{p.records.total}
            </text>
          )}
        </g>
        {p.activityCount > 0 && (
          <g
            role="button"
            tabIndex={0}
            aria-expanded={p.foldedActivities === 0}
            aria-label={t('activitiesCount', { count: p.activityCount })}
            className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-focus"
            onClick={() => toggle(node.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(node.id);
              }
            }}
          >
            <rect
              x={p.x + NODE_W - 78}
              y={p.y + NODE_H - 17}
              width={72}
              height={14}
              rx={7}
              className="fill-surface-subtle stroke-line"
            />
            <text
              x={p.x + NODE_W - 42}
              y={p.y + NODE_H - 7}
              textAnchor="middle"
              className="fill-ink-secondary text-[9.5px]"
            >
              {p.foldedActivities > 0 ? '▸' : '▾'} {t('activitiesCount', { count: p.activityCount })}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <Card className="mt-6" data-testid="scope-map">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{t('subtitle')}</p>
          </div>
          {expandable.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(expandable))}>
                {tExpand(t, true)}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
                {tExpand(t, false)}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasWbs ? (
          <p className="text-sm text-ink-secondary">{t('empty')}</p>
        ) : (
          <div className="max-h-[620px] overflow-auto rounded-md border border-line bg-canvas">
            <svg
              role="group"
              aria-label={t('title')}
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="block"
            >
              <defs>
                <marker
                  id="scope-map-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" className="fill-warning" />
                </marker>
              </defs>
              {COLUMN_KEYS.slice(0, COLUMN_COUNT).map((key, col) => (
                <text
                  key={key}
                  x={colX(col)}
                  y={PAD + HEADER_H - 10}
                  className="fill-ink-muted text-[10.5px] font-semibold uppercase tracking-wide"
                >
                  {t(key)}
                </text>
              ))}
              {layout.edges.map((e, i) => {
                const a = at.get(e.from);
                const b = at.get(e.to);
                if (!a || !b) return null;
                if (e.kind === 'depends') {
                  const x = a.x;
                  const y1 = a.y + NODE_H / 2;
                  const y2 = b.y + NODE_H / 2;
                  return (
                    <path
                      key={`${e.from}-${e.to}-${i}`}
                      d={`M ${x} ${y1} C ${x - 34} ${y1}, ${x - 34} ${y2}, ${b.x} ${y2}`}
                      className="fill-none stroke-warning"
                      strokeWidth={1.25}
                      strokeDasharray="4 3"
                      markerEnd="url(#scope-map-arrow)"
                    />
                  );
                }
                return (
                  <path
                    key={`${e.from}-${e.to}-${i}`}
                    d={edgePath(a.x + NODE_W, a.y + NODE_H / 2, b.x, b.y + NODE_H / 2)}
                    className="fill-none stroke-line-strong"
                    strokeWidth={1.25}
                    opacity={0.7}
                  />
                );
              })}
              {layout.nodes.map(renderNode)}
            </svg>
          </div>
        )}

        <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-secondary">
          <Legend swatch="fill-success-bg stroke-success" text={t('legendDone')} />
          <Legend swatch="fill-info-bg stroke-info" text={t('legendActive')} />
          <Legend swatch="fill-surface stroke-line-strong" text={t('legendTodo')} />
          <Legend swatch="fill-none stroke-warning" dashed text={t('legendGap')} />
        </ul>

        <Coverage checks={map.checks} nameOf={(id) => nameOf(id)?.label ?? id} hrefOf={(id) => `${base}/tasks/${id}`} />
      </CardContent>
    </Card>
  );
}

function tExpand(t: ReturnType<typeof useTranslations>, open: boolean) {
  return open ? t('expandAll') : t('collapseAll');
}

function Legend({ swatch, text, dashed }: { swatch: string; text: string; dashed?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="16" height="12" aria-hidden="true">
        <rect
          x="1"
          y="1"
          width="14"
          height="10"
          rx="3"
          className={swatch}
          strokeWidth="1.5"
          strokeDasharray={dashed ? '3 2' : undefined}
        />
      </svg>
      {text}
    </li>
  );
}

function Coverage({
  checks,
  nameOf,
  hrefOf,
}: {
  checks: CoverageCheck[];
  nameOf: (id: string) => string;
  hrefOf: (id: string) => string;
}) {
  const t = useTranslations('dashboard.project.scopeMap');
  const failing = checks.filter((c) => c.offenders.length > 0);
  return (
    <div className="mt-5" data-testid="scope-coverage">
      <h3 className="text-sm font-semibold text-ink-primary">{t('coverageTitle')}</h3>
      {failing.length === 0 ? (
        <p className="mt-2 text-sm text-success">✓ {t('allGood')}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {failing.map((c) => (
            <li key={c.key} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">
                  {c.offenders.length}/{c.total}
                </Badge>
                <span className="font-medium text-ink-primary">{t(`checks.${c.key}` as never)}</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{t(`checkHelp.${c.key}` as never)}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {c.offenders.slice(0, 4).map((id) => (
                  <Link key={id} href={hrefOf(id)} className="text-action-primary hover:underline">
                    {truncate(nameOf(id), 40)}
                  </Link>
                ))}
                {c.offenders.length > 4 && (
                  <span className="text-ink-muted">{t('moreItems', { count: c.offenders.length - 4 })}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

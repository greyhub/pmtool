'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import type { DailySnapshotDto, ReportMetricKey, ReportTaskRefDto } from '@pmtool/shared-types';
import { useDailyReport } from '@pmtool/api-client';
import { Badge, Button, Card, Input, Select } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { deltaTone, formatDelta, shiftDate, type DeltaTone } from './delta';
import { TrendChart } from './trend-chart';

type Compare = 'prev' | 'week' | 'custom';
type TrendMetric = 'progressPct' | 'done' | 'overdue' | 'openRisks';

const TONE_CLASS: Record<DeltaTone, string> = {
  good: 'bg-success-bg text-success',
  bad: 'bg-danger-bg text-danger',
  neutral: 'bg-surface-subtle text-ink-secondary',
  flat: 'bg-surface-subtle text-ink-muted',
};

function vnToday(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function DeltaChip({
  metric,
  delta,
  unit,
}: {
  metric: ReportMetricKey;
  delta: number | undefined;
  unit?: string;
}) {
  const t = useTranslations('reports');
  if (delta === undefined) return <span className="text-xs text-ink-muted">{t('noCompare')}</span>;
  const tone = deltaTone(metric, delta);
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${TONE_CLASS[tone]}`}
    >
      {arrow && <span aria-hidden="true">{arrow}</span>}
      {delta === 0 ? t('unchanged') : `${formatDelta(delta)}${unit ?? ''}`}
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  metric,
  delta,
  unit,
}: {
  label: string;
  value: string;
  sub?: string;
  metric: ReportMetricKey;
  delta: number | undefined;
  unit?: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4" data-testid={`kpi-${metric}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-ink-primary">
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-ink-muted">{sub}</span>}
      </span>
      <DeltaChip metric={metric} delta={delta} unit={unit} />
    </Card>
  );
}

function TaskList({
  title,
  tasks,
  empty,
  orgSlug,
  projectKey,
}: {
  title: string;
  tasks: ReportTaskRefDto[];
  empty: string;
  orgSlug: string;
  projectKey: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="text-sm font-semibold text-ink-primary">
        {title} <span className="font-normal text-ink-muted">({tasks.length})</span>
      </h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/${orgSlug}/projects/${projectKey}/tasks/${task.id}`}
                className="flex items-baseline gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-subtle"
              >
                <span className="font-mono text-xs text-ink-muted">{task.humanKey}</span>
                <span className="truncate text-ink-primary">{task.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DailyReportView({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const params = useSearchParams();
  const today = vnToday();
  const fromLink = params.get('date');
  const [date, setDate] = useState(
    fromLink && /^\d{4}-\d{2}-\d{2}$/.test(fromLink) && fromLink <= today ? fromLink : today,
  );
  const [compare, setCompare] = useState<Compare>('prev');
  const [custom, setCustom] = useState('');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('progressPct');

  const compareTo =
    compare === 'week'
      ? shiftDate(date, -7)
      : compare === 'custom' && custom && custom < date
        ? custom
        : undefined;
  const {
    data: report,
    isLoading,
    isError,
  } = useDailyReport(orgSlug, projectKey, date === today ? undefined : date, compareTo);

  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T00:00:00Z`));
  const fmtShort = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T00:00:00Z`));

  const c: DailySnapshotDto | null = report?.current ?? null;
  const d = report?.deltas as Partial<Record<ReportMetricKey, number>> | undefined;
  const hasCompare = d !== undefined && Object.keys(d).length > 0;
  const dv = (k: ReportMetricKey) => (hasCompare ? d![k] : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-label={t('prevDay')}
              onClick={() => setDate(shiftDate(date, -1))}
            >
              ‹
            </Button>
            <Input
              aria-label={t('date')}
              type="date"
              className="w-40"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              aria-label={t('nextDay')}
              disabled={date >= today}
              onClick={() => setDate(shiftDate(date, 1))}
            >
              ›
            </Button>
            {date !== today && (
              <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
                {t('today')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="compare-mode" className="text-sm text-ink-secondary">
              {t('compareWith')}
            </label>
            <Select
              id="compare-mode"
              className="w-40"
              value={compare}
              onChange={(e) => setCompare(e.target.value as Compare)}
            >
              <option value="prev">{t('comparePrev')}</option>
              <option value="week">{t('compareWeek')}</option>
              <option value="custom">{t('compareCustom')}</option>
            </Select>
            {compare === 'custom' && (
              <Input
                aria-label={t('compareDate')}
                type="date"
                className="w-40"
                value={custom}
                max={shiftDate(date, -1)}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-ink-secondary">{t('loading')}</p>}
      {isError && (
        <p role="alert" className="text-sm text-danger">
          {t('error')}
        </p>
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <span className="font-medium text-ink-primary">{fmt(report.date)}</span>
            {c && (
              <Badge variant={report.isLive ? 'warning' : 'success'}>
                {report.isLive ? t('live') : t('closed')}
              </Badge>
            )}
            <span>{t('comparedWith', { date: fmtShort(report.comparedTo) })}</span>
          </div>

          {!c && (
            <Card className="p-6 text-sm text-ink-secondary" data-testid="no-data">
              {t('noData')}
            </Card>
          )}
          {c && !report.previous && (
            <p
              className="rounded-md bg-info-bg px-3 py-2 text-sm text-info"
              data-testid="no-previous"
            >
              {t('noPrevious', { date: fmtShort(report.comparedTo) })}
            </p>
          )}

          {c && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Kpi
                  label={t('kpi.progress')}
                  value={`${Math.round(c.progressPct * 10) / 10}%`}
                  metric="progressPct"
                  delta={dv('progressPct')}
                  unit=" pt"
                />
                <Kpi
                  label={t('kpi.done')}
                  value={String(c.done)}
                  sub={`/ ${c.tasksTotal}`}
                  metric="done"
                  delta={dv('done')}
                />
                <Kpi
                  label={t('kpi.overdue')}
                  value={String(c.overdue)}
                  metric="overdue"
                  delta={dv('overdue')}
                />
                <Kpi
                  label={t('kpi.blocked')}
                  value={String(c.blocked)}
                  metric="blocked"
                  delta={dv('blocked')}
                />
                <Kpi
                  label={t('kpi.inProgress')}
                  value={String(c.inProgress + c.inReview)}
                  metric="inProgress"
                  delta={hasCompare ? (d!.inProgress ?? 0) + (d!.inReview ?? 0) : undefined}
                />
                <Kpi
                  label={t('kpi.openRisks')}
                  value={String(c.openRisks)}
                  sub={t('kpi.issuesSub', { count: c.openIssues })}
                  metric="openRisks"
                  delta={dv('openRisks')}
                />
                <Kpi
                  label={t('kpi.deliverables')}
                  value={String(c.deliverablesAccepted)}
                  sub={`/ ${c.deliverablesTotal}`}
                  metric="deliverablesAccepted"
                  delta={dv('deliverablesAccepted')}
                />
                <Kpi
                  label={t('kpi.milestones')}
                  value={String(c.milestonesDone)}
                  sub={`/ ${c.milestonesTotal}`}
                  metric="milestonesDone"
                  delta={dv('milestonesDone')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Kpi
                  label={t('kpi.completedToday')}
                  value={String(c.completedCount)}
                  metric="completedCount"
                  delta={dv('completedCount')}
                />
                <Kpi
                  label={t('kpi.createdToday')}
                  value={String(c.createdCount)}
                  metric="createdCount"
                  delta={dv('createdCount')}
                />
                <Kpi
                  label={t('kpi.activity')}
                  value={String(c.activityCount)}
                  metric="activityCount"
                  delta={dv('activityCount')}
                />
                <Kpi
                  label={t('kpi.people')}
                  value={String(c.activeUsers)}
                  metric="activeUsers"
                  delta={dv('activeUsers')}
                />
              </div>
              {c.sprintPlanned !== null && (
                <p className="text-sm text-ink-secondary">
                  {t('sprintLine', { done: c.sprintDone ?? 0, planned: c.sprintPlanned })}
                </p>
              )}
            </>
          )}

          <Card className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-primary">{t('trend.title')}</h2>
              <Select
                aria-label={t('trend.metric')}
                className="w-48"
                value={trendMetric}
                onChange={(e) => setTrendMetric(e.target.value as TrendMetric)}
              >
                <option value="progressPct">{t('kpi.progress')}</option>
                <option value="done">{t('kpi.done')}</option>
                <option value="overdue">{t('kpi.overdue')}</option>
                <option value="openRisks">{t('kpi.openRisks')}</option>
              </Select>
            </div>
            {report.trend.length < 2 ? (
              <p className="text-sm text-ink-muted">{t('trend.few')}</p>
            ) : (
              <TrendChart
                points={report.trend}
                metric={trendMetric}
                label={t('trend.title')}
                highlightDate={report.date}
                locale={locale}
              />
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TaskList
              title={t('lists.completed')}
              tasks={report.highlights.completed}
              empty={t('lists.completedEmpty')}
              orgSlug={orgSlug}
              projectKey={projectKey}
            />
            <TaskList
              title={t('lists.dueNotDone')}
              tasks={report.highlights.dueNotDone}
              empty={t('lists.dueNotDoneEmpty')}
              orgSlug={orgSlug}
              projectKey={projectKey}
            />
            {report.isLive && (
              <TaskList
                title={t('lists.blocked')}
                tasks={report.highlights.blocked}
                empty={t('lists.blockedEmpty')}
                orgSlug={orgSlug}
                projectKey={projectKey}
              />
            )}
          </div>
          <p className="text-xs text-ink-muted">{t('footnote')}</p>
        </>
      )}
    </div>
  );
}

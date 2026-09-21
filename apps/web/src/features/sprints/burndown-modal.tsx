'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { BurndownStatus } from '@pmtool/shared-types';
import { useSprintBurndown } from '@pmtool/api-client';
import { Badge, Button, Modal } from '@pmtool/ui';
import { BurndownChart } from './burndown-chart';

const VARIANT: Record<BurndownStatus, 'neutral' | 'success' | 'info' | 'warning' | 'danger'> = {
  not_started: 'neutral',
  ahead: 'success',
  on_track: 'info',
  behind: 'danger',
  closed: 'neutral',
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function BurndownModal({
  orgSlug,
  projectKey,
  sprintId,
  name,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  sprintId: string | null;
  name: string;
  onClose: () => void;
}) {
  const t = useTranslations('sprints.burndown');
  const locale = useLocale();
  const { data, isLoading, isError } = useSprintBurndown(
    orgSlug,
    projectKey,
    sprintId ?? undefined,
  );
  const unit = data ? t(data.unit === 'POINTS' ? 'points' : 'hours') : '';

  return (
    <Modal
      open={Boolean(sprintId)}
      onClose={onClose}
      title={t('title', { name })}
      className="max-w-3xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('close')}
        </Button>
      }
    >
      {isLoading && <p className="text-sm text-ink-secondary">{t('loading')}</p>}
      {isError && (
        <p role="alert" className="text-sm text-danger">
          {t('error')}
        </p>
      )}
      {data && (
        <div className="flex flex-col gap-4" data-testid="burndown">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={VARIANT[data.pace.status]}>{t(`status.${data.pace.status}`)}</Badge>
            <span className="text-sm text-ink-secondary" data-testid="burndown-verdict">
              {data.pace.status === 'behind' &&
                t('verdict.behind', { value: fmt(Math.abs(data.pace.deltaVsIdeal)), unit })}
              {data.pace.status === 'ahead' &&
                t('verdict.ahead', { value: fmt(Math.abs(data.pace.deltaVsIdeal)), unit })}
              {data.pace.status === 'on_track' && t('verdict.onTrack')}
              {data.pace.status === 'closed' &&
                t('verdict.closed', { done: fmt(data.done), planned: fmt(data.planned), unit })}
              {data.pace.status === 'not_started' && t('verdict.notStarted')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t('stats.committed'), data.committed === null ? '—' : fmt(data.committed)],
              [t('stats.done'), fmt(data.done)],
              [t('stats.remaining'), fmt(data.remaining)],
              [t('stats.scope'), `${data.scopeChange > 0 ? '+' : ''}${fmt(data.scopeChange)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-surface-subtle px-3 py-2">
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="text-lg font-semibold tabular-nums text-ink-primary">
                  {value} <span className="text-xs font-normal text-ink-muted">{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {data.pace.status === 'not_started' ? (
            <p className="text-sm text-ink-secondary">{t('notStartedHint')}</p>
          ) : (
            <>
              <BurndownChart
                data={data}
                locale={locale}
                label={t('chartLabel')}
                todayLabel={t('today')}
              />
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-0 w-6 border-t-2 border-dashed border-ink-muted"
                  />{' '}
                  {t('legend.ideal')}
                </li>
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-0.5 w-6 rounded bg-action-primary"
                  />{' '}
                  {t('legend.actual')}
                </li>
                {data.days.some((d) => d.estimated) && (
                  <li className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 rounded-full border-2 border-action-primary bg-surface"
                    />{' '}
                    {t('legend.estimated')}
                  </li>
                )}
                <li className="font-semibold text-warning">+N {t('legend.scope')}</li>
              </ul>
              {data.pace.status !== 'closed' && data.pace.burnPerDay > 0 && (
                <p className="text-sm text-ink-secondary" data-testid="burndown-forecast">
                  {t('forecast', {
                    rate: fmt(data.pace.burnPerDay),
                    unit,
                    left: fmt(data.pace.projectedRemainingAtEnd),
                  })}
                </p>
              )}
              {data.pace.overrunDays > 0 && (
                <p role="note" className="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
                  {t('overrun', { days: data.pace.overrunDays })}
                </p>
              )}
              <p className="text-xs text-ink-muted">{t('footnote')}</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

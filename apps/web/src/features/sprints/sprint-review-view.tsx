'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { GoalResult, ReviewItemDto } from '@pmtool/shared-types';
import { ApiError, useSprintReview, useUpdateSprintReview } from '@pmtool/api-client';
import { Avatar, Badge, Button, Card } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { usePermissions } from '../projects/use-permissions';
import { BurndownModal } from './burndown-modal';
import { reviewToText, type ReviewTextLabels } from './review-text';
import { VelocityChart } from './velocity-chart';

const GOALS: GoalResult[] = ['MET', 'PARTIAL', 'MISSED'];
const GOAL_VARIANT = { MET: 'success', PARTIAL: 'warning', MISSED: 'danger' } as const;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Kpi({
  label,
  value,
  sub,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  testId?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4" data-testid={testId}>
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-ink-primary">{value}</span>
      {sub && <span className="text-xs text-ink-secondary">{sub}</span>}
    </Card>
  );
}

function ItemList({
  items,
  orgSlug,
  projectKey,
  empty,
  unitLabel,
  addedTag,
  carried,
}: {
  items: ReviewItemDto[];
  orgSlug: string;
  projectKey: string;
  empty: string;
  unitLabel: string;
  addedTag: string;
  carried: (i: ReviewItemDto) => string | null;
}) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((i) => (
        <li
          key={i.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-subtle"
        >
          {i.assignee ? (
            <Avatar name={i.assignee.name} character={i.assignee.character} size="sm" />
          ) : (
            <span className="h-8 w-8 shrink-0" aria-hidden="true" />
          )}
          <span className="font-mono text-xs text-ink-muted">{i.humanKey}</span>
          <Link
            href={`/${orgSlug}/projects/${projectKey}/tasks/${i.id}`}
            className="min-w-0 flex-1 truncate text-ink-primary hover:underline"
          >
            {i.title}
          </Link>
          {i.addedMidSprint && <Badge variant="warning">{addedTag}</Badge>}
          {carried(i) && <Badge variant="neutral">{carried(i)}</Badge>}
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-secondary">
            {fmt(i.load)} {unitLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SprintReviewView({
  orgSlug,
  projectKey,
  sprintId,
}: {
  orgSlug: string;
  projectKey: string;
  sprintId: string;
}) {
  const t = useTranslations('sprints.review');
  const tGoal = useTranslations('sprints.review.goalResult');
  const locale = useLocale();
  const { data: r, isLoading, error } = useSprintReview(orgSlug, projectKey, sprintId);
  const update = useUpdateSprintReview(orgSlug, projectKey);
  const { canManage } = usePermissions(orgSlug, projectKey);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBurndown, setShowBurndown] = useState(false);

  useEffect(() => {
    if (r && !dirty) setNotes(r.reviewNotes ?? '');
  }, [r, dirty]);

  if (isLoading) return <p className="text-sm text-ink-secondary">{t('loading')}</p>;
  if (error || !r) {
    return (
      <Card className="flex flex-col gap-3 p-6">
        <p role="alert" className="text-sm text-ink-secondary" data-testid="review-unavailable">
          {error instanceof ApiError && error.status === 409 ? t('notStarted') : t('error')}
        </p>
        <Link
          href={`/${orgSlug}/projects/${projectKey}/sprints`}
          className="text-sm text-ink-primary underline"
        >
          {t('back')}
        </Link>
      </Card>
    );
  }

  const unitLabel = t(r.unit === 'POINTS' ? 'points' : 'hours');
  const s = r.summary;
  const date = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${d}T00:00:00Z`));
  const period = `${date(r.sprint.startDate)} → ${date(r.sprint.endDate)}`;
  const carried = (i: ReviewItemDto) =>
    i.carriedTo
      ? i.carriedTo.kind === 'sprint'
        ? t('carriedSprint', { name: i.carriedTo.name ?? '' })
        : t('carriedBacklog')
      : null;
  const velocityDelta =
    r.velocityAvg === null ? null : Math.round((s.completed - r.velocityAvg) * 10) / 10;

  const textLabels: ReviewTextLabels = {
    title: t('textTitle', { name: r.sprint.name }),
    period,
    goal: t('goal'),
    goalResult: {
      MET: tGoal('MET'),
      PARTIAL: tGoal('PARTIAL'),
      MISSED: tGoal('MISSED'),
      none: t('goalNone'),
    },
    summary: t('summary'),
    committed: t('kpi.committed'),
    completed: t('kpi.completed'),
    added: t('kpi.added'),
    unfinished: t('kpi.unfinished'),
    velocity: t('kpi.velocity'),
    delivered: t('delivered'),
    left: t('left'),
    people: t('people'),
    notes: t('notes'),
    carriedSprint: (name) => t('carriedSprint', { name }),
    carriedBacklog: t('carriedBacklog'),
    addedTag: t('addedTag'),
    unit: unitLabel,
    preview: t('previewShort'),
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(reviewToText(r!, textLabels));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions): the print button still works.
    }
  }

  function save(input: { reviewNotes?: string | null; goalResult?: GoalResult | null }) {
    setSaved(false);
    update.mutate(
      { sprintId, input },
      {
        onSuccess: () => {
          setDirty(false);
          setSaved(true);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={`/${orgSlug}/projects/${projectKey}/sprints`}
            className="text-sm text-ink-secondary hover:text-ink-primary print:hidden"
          >
            ← {t('back')}
          </Link>
          <h1 className="text-lg font-semibold text-ink-primary">
            {t('title', { name: r.sprint.name })}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <span>{period}</span>
            <Badge variant={r.isPreview ? 'warning' : 'success'}>
              {r.isPreview ? t('preview') : t('closed')}
            </Badge>
          </div>
          {r.sprint.goal && (
            <p className="mt-1 text-sm text-ink-primary">
              <span className="text-ink-muted">{t('goal')}: </span>“{r.sprint.goal}”
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => setShowBurndown(true)}>
            {t('burndown')}
          </Button>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? t('copied') : t('copy')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            {t('print')}
          </Button>
        </div>
      </div>

      {r.isPreview && (
        <p
          role="note"
          className="rounded-md bg-info-bg px-3 py-2 text-sm text-info"
          data-testid="review-preview"
        >
          {t('previewNote')}
        </p>
      )}
      {!r.detailsAvailable && (
        <p
          role="note"
          className="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning"
          data-testid="review-partial"
        >
          {t('partialNote')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi
          label={t('kpi.committed')}
          value={s.committed === null ? '—' : fmt(s.committed)}
          sub={unitLabel}
          testId="kpi-committed"
        />
        <Kpi
          label={t('kpi.completed')}
          value={`${fmt(s.completed)} / ${fmt(s.finalPlanned)}`}
          sub={`${s.completionPct}% · ${unitLabel}`}
          testId="kpi-completed"
        />
        <Kpi
          label={t('kpi.added')}
          value={`${s.added > 0 ? '+' : ''}${fmt(s.added)}`}
          sub={t('kpi.addedSub', { count: s.addedCount })}
          testId="kpi-added"
        />
        <Kpi
          label={t('kpi.unfinished')}
          value={fmt(s.unfinished)}
          sub={t('kpi.itemsSub', { count: s.unfinishedCount })}
          testId="kpi-unfinished"
        />
        <Kpi
          label={t('kpi.velocity')}
          value={r.velocityAvg === null ? '—' : fmt(r.velocityAvg)}
          sub={
            velocityDelta === null
              ? t('kpi.noVelocity')
              : t('kpi.vsAverage', {
                  value: `${velocityDelta > 0 ? '+' : ''}${fmt(velocityDelta)}`,
                })
          }
          testId="kpi-velocity"
        />
      </div>

      <Card className="flex flex-col gap-3 p-4" data-testid="goal-card">
        <h2 className="text-sm font-semibold text-ink-primary">{t('goalTitle')}</h2>
        {canManage ? (
          <div
            className="flex flex-wrap items-center gap-2 print:hidden"
            role="group"
            aria-label={t('goalTitle')}
          >
            {GOALS.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={r.goalResult === g ? 'primary' : 'outline'}
                aria-pressed={r.goalResult === g}
                disabled={update.isPending}
                onClick={() => save({ goalResult: r.goalResult === g ? null : g })}
              >
                {tGoal(g)}
              </Button>
            ))}
          </div>
        ) : null}
        <p className={canManage ? 'hidden print:block' : ''}>
          {r.goalResult ? (
            <Badge variant={GOAL_VARIANT[r.goalResult]}>{tGoal(r.goalResult)}</Badge>
          ) : (
            <span className="text-sm text-ink-muted">{t('goalNone')}</span>
          )}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold text-ink-primary">
            {t('delivered')}{' '}
            <span className="font-normal text-ink-muted">({r.delivered.length})</span>
          </h2>
          <ItemList
            items={r.delivered}
            orgSlug={orgSlug}
            projectKey={projectKey}
            empty={t('deliveredEmpty')}
            unitLabel={unitLabel}
            addedTag={t('addedTag')}
            carried={carried}
          />
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold text-ink-primary">
            {t('left')} <span className="font-normal text-ink-muted">({r.unfinished.length})</span>
          </h2>
          <ItemList
            items={r.unfinished}
            orgSlug={orgSlug}
            projectKey={projectKey}
            empty={t('leftEmpty')}
            unitLabel={unitLabel}
            addedTag={t('addedTag')}
            carried={carried}
          />
        </Card>
      </div>

      {r.people.length > 0 && (
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold text-ink-primary">{t('people')}</h2>
          <ul className="flex flex-col gap-1">
            {r.people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm">
                <Avatar name={p.name} character={p.character} size="sm" />
                <span className="min-w-0 flex-1 truncate text-ink-primary">{p.name}</span>
                <span className="tabular-nums text-ink-secondary">
                  {fmt(p.doneLoad)} {unitLabel} · {t('peopleDone', { count: p.doneCount })}
                  {p.unfinishedCount > 0 && (
                    <span className="text-ink-muted">
                      {' '}
                      · {t('peopleOpen', { count: p.unfinishedCount })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-ink-primary">{t('trend')}</h2>
        {r.history.length < 2 ? (
          <p className="text-sm text-ink-muted">{t('trendFew')}</p>
        ) : (
          <VelocityChart
            history={r.history}
            average={r.velocityAvg}
            label={t('trend')}
            committedLabel={t('kpi.committed')}
            completedLabel={t('kpi.completed')}
            averageLabel={t('kpi.velocity')}
          />
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-ink-primary">{t('notes')}</h2>
        {canManage ? (
          <>
            <textarea
              aria-label={t('notes')}
              rows={5}
              maxLength={5000}
              value={notes}
              placeholder={t('notesPlaceholder')}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
                setSaved(false);
              }}
              className="glass-field w-full rounded-md border border-line-glass px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus print:hidden"
            />
            <p className="hidden whitespace-pre-wrap text-sm text-ink-primary print:block">
              {notes}
            </p>
            <div className="flex items-center gap-3 print:hidden">
              <Button
                size="sm"
                disabled={!dirty || update.isPending}
                onClick={() => save({ reviewNotes: notes })}
              >
                {t('saveNotes')}
              </Button>
              {saved && (
                <span role="status" className="text-sm text-success">
                  {t('saved')}
                </span>
              )}
              {update.isError && (
                <span role="alert" className="text-sm text-danger">
                  {t('saveError')}
                </span>
              )}
            </div>
          </>
        ) : r.reviewNotes ? (
          <p className="whitespace-pre-wrap text-sm text-ink-primary">{r.reviewNotes}</p>
        ) : (
          <p className="text-sm text-ink-muted">{t('notesNone')}</p>
        )}
      </Card>

      <BurndownModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        sprintId={showBurndown ? sprintId : null}
        name={r.sprint.name}
        onClose={() => setShowBurndown(false)}
      />
    </div>
  );
}

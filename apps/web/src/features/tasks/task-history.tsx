'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTaskHistory } from '@pmtool/api-client';
import type { TaskChangeDto } from '@pmtool/shared-types';
import { UserAvatar } from '../people/user-avatar';
import { formatDate } from '../../lib/date-input';
import { formatRelativeTime } from '../../lib/relative-time';

const VISIBLE = 5;

/** The timeline of edits to a task: who changed what, from what to what. */
export function TaskHistory({ orgSlug, projectKey, taskId }: { orgSlug: string; projectKey: string; taskId: string }) {
  const t = useTranslations('tasks.history');
  const tStatus = useTranslations('tasks.status');
  const tPriority = useTranslations('tasks.priority');
  const locale = useLocale();
  const { data: entries } = useTaskHistory(orgSlug, projectKey, taskId);
  const [showAll, setShowAll] = useState(false);

  const value = (field: string, v: TaskChangeDto['from']): string => {
    if (v === null || v === undefined || v === '') return t('none');
    if (field === 'status') return tStatus(v as never);
    if (field === 'priority') return tPriority(v as never);
    if (field === 'startDate' || field === 'dueDate') return formatDate(String(v), locale === 'en' ? 'en-GB' : 'vi-VN');
    if (field === 'percentComplete') return `${v}%`;
    if (field === 'isMilestone') return v ? t('yes') : t('no');
    return String(v);
  };

  const describe = (c: TaskChangeDto): string => {
    const label = t(`fields.${c.field}` as never);
    if (c.field === 'description') return t('editedDescription');
    if (c.field === 'supporters') {
      const parts: string[] = [];
      if (c.added?.length) parts.push(t('supportersAdded', { names: c.added.join(', ') }));
      if (c.removed?.length) parts.push(t('supportersRemoved', { names: c.removed.join(', ') }));
      return parts.join('; ');
    }
    return t('changed', { field: label, from: value(c.field, c.from), to: value(c.field, c.to) });
  };

  if (!entries || entries.length === 0) return null;
  const shown = showAll ? entries : entries.slice(0, VISIBLE);

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-secondary">{t('title')}</h3>
      <ol className="mt-3 flex flex-col gap-3">
        {shown.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <UserAvatar userId={entry.actor.id} name={entry.actor.fullName} />
            <div className="min-w-0 text-sm">
              <p className="text-ink-primary">
                <span className="font-medium">{entry.actor.fullName}</span>{' '}
                {entry.action === 'created' ? (
                  <span className="text-ink-secondary">{t('created')}</span>
                ) : (
                  <span className="text-ink-secondary">{t('madeChanges')}</span>
                )}
                <time
                  dateTime={entry.createdAt}
                  title={new Date(entry.createdAt).toLocaleString(locale)}
                  className="ml-2 text-xs text-ink-muted"
                >
                  {formatRelativeTime(entry.createdAt, locale)}
                </time>
              </p>
              {entry.changes.length > 0 && (
                <ul className="mt-0.5 flex flex-col gap-0.5 break-words text-ink-secondary">
                  {entry.changes.map((c) => (
                    <li key={c.field}>{describe(c)}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
      {entries.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm text-action-primary hover:underline"
        >
          {showAll ? t('showLess') : t('showAll', { count: entries.length })}
        </button>
      )}
    </div>
  );
}

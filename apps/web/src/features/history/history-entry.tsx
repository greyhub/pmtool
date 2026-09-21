'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { HistoryEntryDto } from '@pmtool/shared-types';
import { Avatar, Badge } from '@pmtool/ui';
import { formatRelativeTime } from '../../lib/relative-time';
import { classifyValue, isOpaqueChange, snapshotHighlights } from './history-format';

export interface PersonInfo {
  name: string;
  character: string;
}

const ACTION_VARIANT = { CREATE: 'success', UPDATE: 'info', DELETE: 'danger' } as const;

/** One recorded change: who, what kind of change, to which item, and the fields (before → after). */
export function HistoryEntry({
  entry,
  people,
  showProject = false,
}: {
  entry: HistoryEntryDto;
  people: Map<string, PersonInfo>;
  showProject?: boolean;
}) {
  const t = useTranslations('history');
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const stamp = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(entry.at),
  );

  const fieldName = (f: string) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f);
  const value = (field: string, v: unknown): string => {
    if (v === '…') return t('hasContent'); // a long field: kept only as "has content"
    const c = classifyValue(field, v);
    switch (c.kind) {
      case 'empty':
        return '—';
      case 'boolean':
        return c.value ? t('yes') : t('no');
      case 'date':
        return dateFmt.format(new Date(c.date));
      case 'person':
        return people.get(c.id)?.name ?? t('unknownPerson');
      case 'enum':
        return t.has(`values.${c.token}`) ? t(`values.${c.token}`) : c.token;
      case 'opaque':
        return t('linked');
      default:
        return c.text;
    }
  };

  // Membership rows are labelled with the member's id; name them.
  const itemName =
    entry.entityType === 'Membership' ||
    entry.entityType === 'ProjectMember' ||
    entry.entityType === 'TaskAssignee'
      ? (entry.label && people.get(entry.label)?.name) || t('unknownPerson')
      : entry.label;
  const typeLabel = t.has(`entityTypes.${entry.entityType}`)
    ? t(`entityTypes.${entry.entityType}`)
    : entry.entityType;
  const actor = entry.actor;

  const changes = entry.changes ?? [];
  const highlights = entry.action !== 'UPDATE' ? snapshotHighlights(entry.snapshot) : [];

  return (
    <li className="flex gap-3 py-3" data-testid={`history-${entry.action}-${entry.entityType}`}>
      {actor ? (
        <Avatar name={actor.fullName} character={actor.mascotCharacter} size="sm" />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded-full bg-surface-subtle" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-primary">
          <span className="font-medium">{actor?.fullName ?? t('system')}</span>
          <Badge variant={ACTION_VARIANT[entry.action]}>{t(`actions.${entry.action}`)}</Badge>
          <span className="text-ink-secondary">{typeLabel}</span>
          {itemName && <span className="min-w-0 truncate font-medium">{itemName}</span>}
          {showProject && entry.projectKey && (
            <span className="font-mono text-xs text-ink-muted">{entry.projectKey}</span>
          )}
        </p>
        {changes.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-sm text-ink-secondary">
            {changes.map((c) => (
              <li key={c.field}>
                <span className="text-ink-muted">{fieldName(c.field)}: </span>
                {c.changed || isOpaqueChange(c) ? (
                  <span>{t('changed')}</span>
                ) : (
                  <>
                    <span className="text-ink-muted line-through">{value(c.field, c.from)}</span> →{' '}
                    <span className="text-ink-primary">{value(c.field, c.to)}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {highlights.length > 0 && (
          <details className="text-sm text-ink-secondary" open={entry.action === 'CREATE'}>
            <summary className="cursor-pointer text-xs text-ink-muted">
              {entry.action === 'DELETE' ? t('deletedContent') : t('initialContent')}
            </summary>
            <ul className="mt-1 flex flex-col gap-0.5">
              {highlights.map(([k, v]) => (
                <li key={k}>
                  <span className="text-ink-muted">{fieldName(k)}: </span>
                  {value(k, v)}
                </li>
              ))}
            </ul>
          </details>
        )}
        <span className="text-xs text-ink-muted" title={stamp}>
          {formatRelativeTime(entry.at, locale)} · {stamp}
        </span>
      </div>
    </li>
  );
}

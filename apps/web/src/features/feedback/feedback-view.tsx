'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useAllFeedback, useSubmitFeedback, useUpdateFeedback } from '@pmtool/api-client';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from '@pmtool/shared-types';
import type { FeedbackCategory, FeedbackDto, FeedbackStatus } from '@pmtool/shared-types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FormField, Select } from '@pmtool/ui';
import { formatRelativeTime } from '../../lib/relative-time';

const STATUS_VARIANT: Record<FeedbackStatus, 'neutral' | 'primary' | 'success' | 'warning' | 'info'> = {
  NEW: 'info',
  PLANNED: 'primary',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  DECLINED: 'neutral',
};

function SubmitCard({ organizationSlug }: { organizationSlug?: string }) {
  const t = useTranslations('feedback');
  const submit = useSubmitFeedback();
  const [category, setCategory] = useState<FeedbackCategory>('IDEA');
  const [message, setMessage] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  if (justSubmitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-lg font-medium text-ink-primary">{t('submitted')}</p>
          <Button
            variant="outline"
            onClick={() => {
              setMessage('');
              setCategory('IDEA');
              setJustSubmitted(false);
            }}
          >
            {t('submitAnother')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(
              {
                category,
                message,
                pageUrl: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
                organizationSlug,
              },
              { onSuccess: () => setJustSubmitted(true) },
            );
          }}
        >
          <p className="text-sm text-ink-secondary">{t('intro')}</p>
          <FormField label={t('category')} htmlFor="feedback-category">
            <Select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            >
              {FEEDBACK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('message')} htmlFor="feedback-message">
            <textarea
              id="feedback-message"
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('messagePlaceholder')}
              className="glass-field w-full rounded-md border border-line-glass px-3 py-2 text-sm text-ink-primary outline-none focus-visible:border-action-primary focus-visible:ring-2 focus-visible:ring-focus"
            />
          </FormField>
          {submit.isError && <p className="text-sm text-danger">{t('errorSubmit')}</p>}
          <Button type="submit" disabled={submit.isPending || message.trim().length === 0}>
            {submit.isPending ? t('submitting') : t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AdminRow({ item }: { item: FeedbackDto }) {
  const t = useTranslations('feedback.admin');
  const tCategory = useTranslations('feedback');
  const locale = useLocale();
  const update = useUpdateFeedback();
  const [note, setNote] = useState(item.adminNote ?? '');

  return (
    <li className="flex flex-col gap-3 border-b border-line-glass py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={item.category === 'BUG' ? 'danger' : 'neutral'}>
          {tCategory(`categories.${item.category}`)}
        </Badge>
        <Badge variant={STATUS_VARIANT[item.status]}>{t(`statuses.${item.status}`)}</Badge>
        <span className="text-xs text-ink-muted">{formatRelativeTime(item.createdAt, locale)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink-primary">{item.message}</p>
      <p className="text-xs text-ink-secondary">
        {t('from', { name: item.user?.fullName ?? item.user?.email ?? '—' })}
        {item.organizationName ? ` · ${t('org', { name: item.organizationName })}` : ''}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label={t('status')} htmlFor={`status-${item.id}`} className="w-40">
          <Select
            id={`status-${item.id}`}
            value={item.status}
            onChange={(e) => update.mutate({ id: item.id, input: { status: e.target.value as FeedbackStatus } })}
          >
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('note')} htmlFor={`note-${item.id}`} className="min-w-[16rem] flex-1">
          <input
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (item.adminNote ?? '')) {
                update.mutate({ id: item.id, input: { adminNote: note || null } });
              }
            }}
            placeholder={t('notePlaceholder')}
            className="glass-field h-10 w-full rounded-md border border-line-glass px-3 text-sm text-ink-primary outline-none focus-visible:border-action-primary focus-visible:ring-2 focus-visible:ring-focus"
          />
        </FormField>
      </div>
    </li>
  );
}

function AdminPanel() {
  const t = useTranslations('feedback.admin');
  const { data, isSuccess } = useAllFeedback();
  const [filter, setFilter] = useState<'ALL' | FeedbackStatus>('ALL');

  if (!isSuccess) return null;

  const items = filter === 'ALL' ? data : data.filter((f) => f.status === filter);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('title')}</CardTitle>
        <Select
          aria-label={t('status')}
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'ALL' | FeedbackStatus)}
          className="w-44"
        >
          <option value="ALL">{t('filterAll')}</option>
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-secondary">{t('empty')}</p>
        ) : (
          <ul>
            {items.map((item) => (
              <AdminRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function FeedbackView() {
  const searchParams = useSearchParams();
  const organizationSlug = searchParams.get('org') ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <SubmitCard organizationSlug={organizationSlug} />
      <AdminPanel />
    </div>
  );
}

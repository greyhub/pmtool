'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useComments, useCreateComment, useMe } from '@pmtool/api-client';
import { Button } from '@pmtool/ui';
import { UserAvatar } from '../people/user-avatar';
import { formatRelativeTime } from '../../lib/relative-time';

export function CommentsSection({
  orgSlug,
  projectKey,
  taskId,
}: {
  orgSlug: string;
  projectKey: string;
  taskId: string;
}) {
  const t = useTranslations('tasks.detail');
  const locale = useLocale();
  const { data: comments } = useComments(orgSlug, projectKey, taskId);
  const { data: me } = useMe();
  const createComment = useCreateComment(orgSlug, projectKey, taskId);
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    createComment.mutate({ body: draft.trim() }, { onSuccess: () => setDraft('') });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-secondary">{t('comments')}</h3>

      <div className="mt-3 flex flex-col gap-4">
        {(comments ?? []).length === 0 && <p className="text-sm text-ink-muted">{t('noComments')}</p>}
        {comments?.map((c) => (
          <div key={c.id} className="flex gap-3">
            <UserAvatar userId={c.author?.id} name={c.author?.fullName ?? ''} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-ink-primary">{c.author?.fullName}</span>
                <time
                  dateTime={c.createdAt}
                  title={new Date(c.createdAt).toLocaleString(locale)}
                  className="text-xs text-ink-muted"
                >
                  {formatRelativeTime(c.createdAt, locale)}
                </time>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-ink-secondary">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <UserAvatar userId={me?.id} name={me?.fullName ?? ''} />
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t('addComment')}
            rows={2}
            className="w-full glass-field rounded-md border border-line-glass px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={submit} disabled={createComment.isPending || !draft.trim()}>
              {t('sendComment')}
            </Button>
            <span className="hidden text-xs text-ink-muted sm:inline">{t('sendHint')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

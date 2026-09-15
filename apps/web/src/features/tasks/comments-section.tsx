'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useComments, useCreateComment, useMe } from '@pmtool/api-client';
import { Avatar, Button } from '@pmtool/ui';

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
            <Avatar name={c.author?.fullName ?? ''} src={c.author?.avatarUrl} size="sm" />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-ink-primary">{c.author?.fullName}</span>
                <span className="text-xs text-ink-muted">{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              <p className="text-sm text-ink-secondary">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <Avatar name={me?.fullName ?? ''} src={me?.avatarUrl} size="sm" />
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('addComment')}
            rows={2}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <div>
            <Button size="sm" onClick={submit} disabled={createComment.isPending || !draft.trim()}>
              {t('sendComment')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useCreateJoinRequest, useMyJoinRequests } from '@pmtool/api-client';
import { Button, FormField, Input } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';

export function JoinOrganizationForm() {
  const t = useTranslations('onboarding.joinOrganization');
  const createRequest = useCreateJoinRequest();
  const { data: mine } = useMyJoinRequests();
  const [slug, setSlug] = useState('');
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          createRequest.mutate(
            { slug: slug.trim(), message: message.trim() || undefined },
            { onSuccess: () => setMessage('') },
          );
        }}
      >
        <FormField label={t('slug')} htmlFor="join-slug" hint={t('slugHint')}>
          <Input id="join-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </FormField>
        <FormField label={t('message')} htmlFor="join-message">
          <textarea
            id="join-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('messagePlaceholder')}
            className="glass-field w-full rounded-md border border-line-glass px-3 py-2 text-sm text-ink-primary outline-none focus-visible:border-action-primary focus-visible:ring-2 focus-visible:ring-focus"
          />
        </FormField>
        {createRequest.isError && (
          <p role="alert" className="text-sm text-danger">
            {createRequest.error instanceof ApiError
              ? createRequest.error.message
              : t('genericError')}
          </p>
        )}
        <Button
          type="submit"
          disabled={createRequest.isPending || slug.trim().length === 0}
          className="mt-2"
        >
          {t('submit')}
        </Button>
      </form>

      {mine && mine.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t('pendingListTitle')}
          </p>
          <ul className="flex flex-col gap-2">
            {mine.map((r) => (
              <li key={r.id} className="text-sm text-ink-secondary">
                {r.status === 'PENDING' && t('statusPending', { name: r.organizationName })}
                {r.status === 'DECLINED' && t('statusDeclined', { name: r.organizationName })}
                {r.status === 'APPROVED' && (
                  <>
                    {t('statusApproved', { name: r.organizationName })}{' '}
                    <Link
                      href={`/${r.organizationSlug}/dashboard`}
                      className="font-medium text-action-primary hover:underline"
                    >
                      {t('goToOrg')}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

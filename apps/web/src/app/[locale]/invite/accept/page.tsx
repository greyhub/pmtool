'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError, useAcceptInvite, useOrganizations } from '@pmtool/api-client';
import { Button, Card } from '@pmtool/ui';
import { RequireAuth } from '../../../../features/auth/require-auth';
import { BackHomeLinksWidget } from '../../../../features/shell/back-home-links-widget';
import { useRouter } from '../../../../i18n/navigation';

function AcceptInviteContent() {
  const t = useTranslations('invites.accept');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const acceptInvite = useAcceptInvite();
  const organizations = useOrganizations();
  const [joinedOrgId, setJoinedOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!joinedOrgId || !organizations.data) return;
    const org = organizations.data.find((o) => o.id === joinedOrgId);
    if (org) {
      router.replace(`/${org.slug}/dashboard`);
    }
  }, [joinedOrgId, organizations.data, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <BackHomeLinksWidget homeHref="/" className="self-start" />
      <Card className="w-full p-8">
        <h1 className="mb-2 text-lg font-semibold text-ink-primary">{t('title')}</h1>
        <p className="mb-6 text-sm text-ink-secondary">{t('description')}</p>

        {acceptInvite.isError && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {acceptInvite.error instanceof ApiError ? acceptInvite.error.message : t('genericError')}
          </p>
        )}

        {!token ? (
          <p className="text-sm text-danger">{t('missingToken')}</p>
        ) : joinedOrgId ? (
          <p className="text-sm text-ink-secondary">{t('redirecting')}</p>
        ) : (
          <Button
            disabled={acceptInvite.isPending}
            onClick={() =>
              acceptInvite.mutate(
                { token },
                { onSuccess: (membership) => setJoinedOrgId(membership.organizationId) },
              )
            }
          >
            {t('accept')}
          </Button>
        )}
      </Card>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <RequireAuth>
      <AcceptInviteContent />
    </RequireAuth>
  );
}

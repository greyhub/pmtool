'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiRequest, useCompleteGoogleSignIn } from '@pmtool/api-client';
import type { OrganizationDto } from '@pmtool/shared-types';
import { CenteredCardPage } from '../../../../../components/centered-card-page';
import { Link, useRouter } from '../../../../../i18n/navigation';
import { safeRedirectTarget } from '../../../../../lib/post-auth-redirect';

function Content() {
  const t = useTranslations('auth.google');
  const router = useRouter();
  const redirect = safeRedirectTarget(useSearchParams().get('redirect'));
  const complete = useCompleteGoogleSignIn();
  const started = useRef(false);

  useEffect(() => {
    // The refresh cookie is single-use: strict-mode's second effect run must not spend it again.
    if (started.current) return;
    started.current = true;
    complete.mutate(undefined, {
      onSuccess: async () => {
        if (redirect) return router.replace(redirect);
        const orgs = await apiRequest<OrganizationDto[]>('/api/v1/organizations').catch(() => [] as OrganizationDto[]);
        router.replace(orgs.length > 0 ? `/${orgs[0]!.slug}/dashboard` : '/onboarding/create-organization');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CenteredCardPage title={t('finishing')}>
      {complete.isError ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-danger">
            {t('failed')}
          </p>
          <Link href="/login" className="text-sm font-medium text-ink-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">{t('working')}</p>
      )}
    </CenteredCardPage>
  );
}

export default function GoogleDonePage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}

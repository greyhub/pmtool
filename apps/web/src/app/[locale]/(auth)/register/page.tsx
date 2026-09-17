'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RegisterForm } from '../../../../features/auth/register-form';
import { Link } from '../../../../i18n/navigation';
import { CenteredCardPage } from '../../../../components/centered-card-page';
import { safeRedirectTarget } from '../../../../lib/post-auth-redirect';

function RegisterPageContent() {
  const t = useTranslations('auth.register');
  const searchParams = useSearchParams();
  const redirectTarget = safeRedirectTarget(searchParams.get('redirect'));
  const loginHref = redirectTarget ? `/login?redirect=${encodeURIComponent(redirectTarget)}` : '/login';

  return (
    <CenteredCardPage
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('hasAccount')}{' '}
          <Link href={loginHref} className="font-medium text-ink-primary hover:underline">
            {t('loginLink')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </CenteredCardPage>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoginForm } from '../../../../features/auth/login-form';
import { Link } from '../../../../i18n/navigation';
import { CenteredCardPage } from '../../../../components/centered-card-page';
import { safeRedirectTarget } from '../../../../lib/post-auth-redirect';

function LoginPageContent() {
  const t = useTranslations('auth.login');
  const searchParams = useSearchParams();
  const redirectTarget = safeRedirectTarget(searchParams.get('redirect'));
  const registerHref = redirectTarget ? `/register?redirect=${encodeURIComponent(redirectTarget)}` : '/register';

  return (
    <CenteredCardPage
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href={registerHref} className="font-medium text-ink-primary hover:underline">
            {t('registerLink')}
          </Link>
        </>
      }
    >
      <LoginForm />
    </CenteredCardPage>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

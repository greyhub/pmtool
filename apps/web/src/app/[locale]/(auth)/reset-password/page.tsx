'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ResetPasswordForm } from '../../../../features/auth/reset-password-form';
import { CenteredCardPage } from '../../../../components/centered-card-page';

function Content() {
  const t = useTranslations('auth.reset');
  const token = useSearchParams().get('token');
  return (
    <CenteredCardPage title={t('title')} subtitle={t('subtitle')}>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p role="alert" className="text-sm text-danger">
          {t('missing')}
        </p>
      )}
    </CenteredCardPage>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}

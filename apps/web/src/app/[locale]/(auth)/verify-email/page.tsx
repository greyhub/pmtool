'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { VerifyEmailStatus } from '../../../../features/auth/verify-email-status';
import { CenteredCardPage } from '../../../../components/centered-card-page';

function Content() {
  const t = useTranslations('auth.verify');
  const token = useSearchParams().get('token');
  return (
    <CenteredCardPage title={t('title')}>
      <VerifyEmailStatus token={token} />
    </CenteredCardPage>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}

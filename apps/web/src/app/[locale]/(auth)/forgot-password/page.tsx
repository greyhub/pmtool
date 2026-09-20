'use client';

import { useTranslations } from 'next-intl';
import { ForgotPasswordForm } from '../../../../features/auth/forgot-password-form';
import { Link } from '../../../../i18n/navigation';
import { CenteredCardPage } from '../../../../components/centered-card-page';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgot');
  return (
    <CenteredCardPage
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <Link href="/login" className="font-medium text-ink-primary hover:underline">
          {t('back')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </CenteredCardPage>
  );
}

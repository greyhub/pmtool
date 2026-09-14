import { useTranslations } from 'next-intl';
import { RegisterForm } from '../../../../features/auth/register-form';
import { Link } from '../../../../i18n/navigation';
import { CenteredCardPage } from '../../../../components/centered-card-page';

export default function RegisterPage() {
  const t = useTranslations('auth.register');

  return (
    <CenteredCardPage
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('hasAccount')}{' '}
          <Link href="/login" className="font-medium text-ink-primary hover:underline">
            {t('loginLink')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </CenteredCardPage>
  );
}

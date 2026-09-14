import { useTranslations } from 'next-intl';
import { LoginForm } from '../../../../features/auth/login-form';
import { Link } from '../../../../i18n/navigation';
import { CenteredCardPage } from '../../../../components/centered-card-page';

export default function LoginPage() {
  const t = useTranslations('auth.login');

  return (
    <CenteredCardPage
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-ink-primary hover:underline">
            {t('registerLink')}
          </Link>
        </>
      }
    >
      <LoginForm />
    </CenteredCardPage>
  );
}

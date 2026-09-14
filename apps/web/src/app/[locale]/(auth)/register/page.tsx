import { useTranslations } from 'next-intl';
import { RegisterForm } from '../../../../features/auth/register-form';
import { Link } from '../../../../i18n/navigation';

export default function RegisterPage() {
  const t = useTranslations('auth.register');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>

        <div className="mt-6">
          <RegisterForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('hasAccount')}{' '}
          <Link href="/login" className="font-medium text-yellow-600 hover:underline dark:text-yellow-400">
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </main>
  );
}

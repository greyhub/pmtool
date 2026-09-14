import { useTranslations } from 'next-intl';
import { Link } from '../../i18n/navigation';

export default function LandingPage() {
  const t = useTranslations('common');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 text-center dark:bg-gray-950">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">{t('appName')}</h1>
      <p className="max-w-md text-gray-500 dark:text-gray-400">
        Ứng dụng quản lý dự án chuẩn PMP — kết hợp gamification và AI.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-yellow-500 px-5 py-2 text-sm font-semibold text-gray-900 transition hover:bg-yellow-400"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
        >
          Đăng ký
        </Link>
      </div>
    </main>
  );
}

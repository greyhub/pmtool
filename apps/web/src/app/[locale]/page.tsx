import { useTranslations } from 'next-intl';
import { Link } from '../../i18n/navigation';

export default function LandingPage() {
  const t = useTranslations('common');
  const tLanding = useTranslations('landing');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold text-ink-primary">{t('appName')}</h1>
      <p className="max-w-md text-ink-secondary">{tLanding('tagline')}</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-ink-on-primary transition-colors hover:bg-action-primary-hover"
        >
          {tLanding('login')}
        </Link>
        <Link
          href="/register"
          className="inline-flex h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink-primary transition-colors hover:bg-surface-subtle"
        >
          {tLanding('register')}
        </Link>
      </div>
    </main>
  );
}

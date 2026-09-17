import { useTranslations } from 'next-intl';
import { Badge, Card } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';

const FEATURE_KEYS = [
  'wbs',
  'kanban',
  'gantt',
  'risks',
  'ai',
  'charter',
  'stakeholders',
  'documents',
  'gamification',
  'telegram',
] as const;

function FeatureCard({ tKey }: { tKey: (typeof FEATURE_KEYS)[number] }) {
  const t = useTranslations(`landing.features.${tKey}`);
  return (
    <Card className="flex flex-col gap-2 p-5">
      <Badge variant="neutral" className="w-fit font-mono text-[10px] uppercase tracking-wide">
        {t('tag')}
      </Badge>
      <h3 className="text-sm font-semibold text-ink-primary">{t('title')}</h3>
      <p className="text-xs leading-relaxed text-ink-secondary">{t('description')}</p>
    </Card>
  );
}

export default function LandingPage() {
  const t = useTranslations('common');
  const tLanding = useTranslations('landing');

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-20 text-center">
        <span className="rounded-full border border-line bg-surface-subtle px-3 py-1 font-mono text-xs text-ink-secondary">
          {tLanding('badge')}
        </span>
        <h1 className="max-w-2xl whitespace-pre-line text-4xl font-extrabold leading-tight tracking-tight text-ink-primary sm:text-5xl">
          {tLanding('heroTitle')}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-ink-secondary">
          {tLanding('heroDescription')}
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-action-primary px-5 text-sm font-semibold text-ink-on-primary transition-colors hover:bg-action-primary-hover"
          >
            {tLanding('login')}
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-md border border-line px-5 text-sm font-semibold text-ink-primary transition-colors hover:bg-surface-subtle"
          >
            {tLanding('register')}
          </Link>
        </div>
      </section>

      {/* Mô hình tổng quan */}
      <section className="border-t border-line-glass py-16">
        <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-wide text-action-primary">
          {tLanding('model.kicker')}
        </p>
        <h2 className="mb-2 text-2xl font-bold text-ink-primary">{tLanding('model.title')}</h2>
        <p className="mb-8 max-w-2xl text-sm text-ink-secondary">{tLanding('model.description')}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {(['org', 'project', 'task'] as const).map((key, i) => (
            <div key={key} className="flex flex-1 items-center gap-3">
              <Card className="flex-1 p-5">
                <p className="mb-1 font-mono text-[11px] text-ink-muted">{tLanding(`model.${key}.label`)}</p>
                <p className="text-base font-bold text-ink-primary">{tLanding(`model.${key}.title`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                  {tLanding(`model.${key}.description`)}
                </p>
              </Card>
              {i < 2 && (
                <span className="hidden shrink-0 text-lg text-ink-muted sm:block" aria-hidden="true">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tính năng chính */}
      <section className="border-t border-line-glass py-16">
        <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-wide text-action-primary">
          {tLanding('features.kicker')}
        </p>
        <h2 className="mb-8 text-2xl font-bold text-ink-primary">{tLanding('features.title')}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((key) => (
            <FeatureCard key={key} tKey={key} />
          ))}
        </div>
      </section>

      {/* CTA đóng */}
      <section className="border-t border-line-glass py-16 text-center">
        <h2 className="mb-2 text-2xl font-bold text-ink-primary">{tLanding('ctaTitle')}</h2>
        <p className="mx-auto mb-6 max-w-md text-sm text-ink-secondary">{tLanding('ctaDescription')}</p>
        <Link
          href="/register"
          className="inline-flex h-11 items-center justify-center rounded-md bg-action-primary px-6 text-sm font-semibold text-ink-on-primary transition-colors hover:bg-action-primary-hover"
        >
          {t('appName')} — {tLanding('register')}
        </Link>
      </section>
    </main>
  );
}

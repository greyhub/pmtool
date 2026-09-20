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
  'scopeWbs',
  'deliverables',
  'stakeholders',
  'documents',
  'artifacts',
  'gamification',
  'telegram',
] as const;

const DOC_LINKS = [
  { key: 'sotay', href: 'https://claude.ai/artifact/TTfAxffk1d6Vo8ENR32S9H', icon: '📘' },
  { key: 'kientruc', href: 'https://claude.ai/artifact/CH4P46mb39FUyWBUd9Az73', icon: '🏛️' },
  { key: 'tongquan', href: 'https://claude.ai/artifact/RpRMH2o6fLMb1WE8MvLY7m', icon: '🧭' },
] as const;

function DocCard({ docKey, href, icon }: { docKey: (typeof DOC_LINKS)[number]['key']; href: string; icon: string }) {
  const t = useTranslations(`landing.docs.${docKey}`);
  const tOpen = useTranslations('landing.docs');
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col gap-2 rounded-xl border border-line-glass bg-surface-glass-strong p-5 shadow-lg shadow-black/5 backdrop-blur-xl transition-transform hover:-translate-y-0.5"
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-ink-primary">{t('title')}</h3>
      <p className="text-xs leading-relaxed text-ink-secondary">{t('description')}</p>
      <span className="mt-1 text-xs font-semibold text-action-primary">{tOpen('open')} →</span>
    </a>
  );
}

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
        <p className="max-w-xl text-base leading-relaxed text-ink-secondary">{tLanding('heroDescription')}</p>
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

      {/* Tài liệu */}
      <section className="border-t border-line-glass py-16">
        <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-wide text-action-primary">
          {tLanding('docs.kicker')}
        </p>
        <h2 className="mb-2 text-2xl font-bold text-ink-primary">{tLanding('docs.title')}</h2>
        <p className="mb-8 max-w-2xl text-sm text-ink-secondary">{tLanding('docs.description')}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DOC_LINKS.map((doc) => (
            <DocCard key={doc.key} docKey={doc.key} href={doc.href} icon={doc.icon} />
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

      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-line-glass py-6 text-xs text-ink-muted">
        <Link href="/terms" className="hover:underline">
          {tLanding('footer.terms')}
        </Link>
        <Link href="/privacy" className="hover:underline">
          {tLanding('footer.privacy')}
        </Link>
      </footer>
    </main>
  );
}

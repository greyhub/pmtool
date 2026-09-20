'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '../../i18n/navigation';
import { privacyDocument, termsDocument, type LegalDocument, type LegalLocale } from './legal-content';

export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const locale: LegalLocale = useLocale() === 'en' ? 'en' : 'vi';
  const t = useTranslations('legal');
  const doc: LegalDocument = kind === 'terms' ? termsDocument(locale) : privacyDocument(locale);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-ink-secondary hover:underline">
        ← {t('home')}
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-ink-primary">{doc.title}</h1>
      <p className="mt-1 text-xs text-ink-muted">{t('updated', { date: doc.updated })}</p>
      <p className="mt-6 text-sm leading-relaxed text-ink-secondary">{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-base font-semibold text-ink-primary">{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p} className="mt-2 text-sm leading-relaxed text-ink-secondary">
              {p}
            </p>
          ))}
          {section.bullets && (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-secondary">
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="mt-12 border-t border-line pt-4 text-xs text-ink-muted">
        <Link href={kind === 'terms' ? '/privacy' : '/terms'} className="hover:underline">
          {kind === 'terms' ? t('privacy') : t('terms')}
        </Link>
      </p>
    </main>
  );
}

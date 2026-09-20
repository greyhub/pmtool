'use client';

import { useLocale, useTranslations } from 'next-intl';
import { getApiBaseUrl, useGoogleSignInEnabled } from '@pmtool/api-client';
import { safeRedirectTarget } from '../../lib/post-auth-redirect';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

/** "Continue with Google" — shown only when the server has Google sign-in configured. */
export function GoogleButton({ label }: { label: 'signIn' | 'signUp' }) {
  const t = useTranslations('auth.google');
  const locale = useLocale();
  const { data } = useGoogleSignInEnabled();
  if (!data?.enabled) return null;

  const redirect = safeRedirectTarget(
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('redirect'),
  );
  const params = new URLSearchParams({ locale });
  if (redirect) params.set('redirect', redirect);

  return (
    <div className="flex flex-col gap-4">
      <a
        href={`${getApiBaseUrl()}/api/v1/auth/google/start?${params.toString()}`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink-primary transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <GoogleLogo />
        {t(label)}
      </a>
      <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t('or')}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

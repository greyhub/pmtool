'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useVerifyEmail } from '@pmtool/api-client';
import { Link } from '../../i18n/navigation';

/** Consumes the emailed link once on load and reports the outcome. */
export function VerifyEmailStatus({ token }: { token: string | null }) {
  const t = useTranslations('auth.verify');
  const verify = useVerifyEmail();
  const started = useRef(false);

  useEffect(() => {
    // Strict-mode double effects must not spend the single-use token twice.
    if (!token || started.current) return;
    started.current = true;
    verify.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token)
    return (
      <p role="alert" className="text-sm text-danger">
        {t('missing')}
      </p>
    );
  if (verify.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {verify.error instanceof ApiError ? verify.error.message : t('error')}
      </p>
    );
  }
  if (verify.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-md bg-success-bg px-3 py-3 text-sm text-success">
          {t('done')}
        </p>
        <Link href="/" className="text-center text-sm font-medium text-ink-primary hover:underline">
          {t('continue')}
        </Link>
      </div>
    );
  }
  return <p className="text-sm text-ink-secondary">{t('working')}</p>;
}

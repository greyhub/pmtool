'use client';

import { useTranslations } from 'next-intl';
import { useMe, useResendVerification } from '@pmtool/api-client';
import { Button } from '@pmtool/ui';

/** A slim reminder shown while the signed-in user's email is unverified. */
export function EmailVerificationBanner() {
  const t = useTranslations('auth.verifyBanner');
  const { data: me } = useMe();
  const resend = useResendVerification();
  if (!me || me.emailVerified) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warning-bg px-4 py-2 text-sm text-warning"
    >
      <span>{t('message', { email: me.email })}</span>
      {resend.isSuccess ? (
        <span className="font-medium">{t('sent')}</span>
      ) : (
        <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => resend.mutate()}>
          {t('resend')}
        </Button>
      )}
      {resend.isError && <span role="alert">{t('error')}</span>}
    </div>
  );
}

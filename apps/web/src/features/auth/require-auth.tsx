'use client';

import { useEffect } from 'react';
import { useMe } from '@pmtool/api-client';
import { usePathname, useRouter } from '../../i18n/navigation';
import { MascotCompanion } from '../shell/mascot-companion';
import { EmailVerificationBanner } from './email-verification-banner';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();

  useEffect(() => {
    if (me.isError) {
      // Read the query string directly instead of next/navigation's
      // useSearchParams() — that hook forces every page using RequireAuth
      // (nearly the whole app) into a Suspense boundary for static
      // prerendering. This only runs client-side inside an effect, so
      // window is always available here.
      const current = pathname + window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(current)}`);
    }
    // Only re-run when auth status changes — re-running on every pathname
    // change would re-navigate mid-typing on the login page itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.isError, router]);

  if (me.isLoading || me.isError) {
    return null;
  }

  return (
    <>
      <EmailVerificationBanner />
      {children}
      <MascotCompanion />
    </>
  );
}

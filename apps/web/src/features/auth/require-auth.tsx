'use client';

import { useEffect } from 'react';
import { useMe } from '@pmtool/api-client';
import { useRouter } from '../../i18n/navigation';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.isError) {
      router.replace('/login');
    }
  }, [me.isError, router]);

  if (me.isLoading || me.isError) {
    return null;
  }

  return <>{children}</>;
}

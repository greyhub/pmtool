'use client';

import { useEffect } from 'react';
import { useOrganization } from '@pmtool/api-client';
import { RequireAuth } from '../auth/require-auth';
import { useRouter } from '../../i18n/navigation';

function OrgGate({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const router = useRouter();
  const org = useOrganization(orgSlug);

  useEffect(() => {
    if (org.isError) {
      router.replace('/onboarding/create-organization');
    }
  }, [org.isError, router]);

  if (org.isLoading || org.isError || !org.data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">{org.data.name}</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}

export function OrgShell({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  return (
    <RequireAuth>
      <OrgGate orgSlug={orgSlug}>{children}</OrgGate>
    </RequireAuth>
  );
}

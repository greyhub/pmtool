'use client';

import { useEffect } from 'react';
import { useOrganization } from '@pmtool/api-client';
import { Sidebar, ThemeSwitcher, TopBar } from '@pmtool/ui';
import { RequireAuth } from '../auth/require-auth';
import { OrgSwitcherWidget } from '../shell/org-switcher-widget';
import { LocaleSwitcherWidget } from '../shell/locale-switcher-widget';
import { UserMenu } from '../shell/user-menu';
import { Link, useRouter, usePathname } from '../../i18n/navigation';

function SidebarLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function OrgGate({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const org = useOrganization(orgSlug);

  useEffect(() => {
    if (org.isError) {
      router.replace('/onboarding/create-organization');
    }
  }, [org.isError, router]);

  if (org.isLoading || org.isError || !org.data) {
    return null;
  }

  const sidebarItems = [{ href: `/${orgSlug}/dashboard`, label: 'Dashboard' }];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-line-glass bg-surface-glass p-4 backdrop-blur-xl md:block">
        <Sidebar items={sidebarItems} activeHref={pathname} LinkComponent={SidebarLink} />
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar
          left={<OrgSwitcherWidget current={org.data} />}
          right={
            <>
              <LocaleSwitcherWidget />
              <ThemeSwitcher />
              <UserMenu />
            </>
          }
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
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

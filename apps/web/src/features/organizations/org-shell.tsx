'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useOrganization } from '@pmtool/api-client';
import { MobileNavDrawer, Sidebar, ThemeSwitcher, TopBar } from '@pmtool/ui';
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function OrgGate({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const org = useOrganization(orgSlug);
  const tNav = useTranslations('nav');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (org.isError) {
      router.replace('/onboarding/create-organization');
    }
  }, [org.isError, router]);

  // Close the drawer on every navigation so it doesn't stay open after tapping a link.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (org.isLoading || org.isError || !org.data) {
    return null;
  }

  const sidebarItems = [
    { href: `/${orgSlug}/dashboard`, label: 'Dashboard' },
    { href: `/${orgSlug}/projects`, label: tNav('projects') },
    { href: `/${orgSlug}/leaderboard`, label: tNav('leaderboard') },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-line-glass bg-surface-glass p-4 backdrop-blur-xl md:block">
        <Sidebar items={sidebarItems} activeHref={pathname} LinkComponent={SidebarLink} />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar
          left={
            <>
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Mở menu điều hướng"
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary md:hidden"
              >
                <MenuIcon />
              </button>
              <OrgSwitcherWidget current={org.data} />
            </>
          }
          right={
            <>
              <div className="hidden sm:block">
                <LocaleSwitcherWidget />
              </div>
              <ThemeSwitcher />
              <UserMenu />
            </>
          }
        />
        <main className="flex-1 p-6">{children}</main>
      </div>

      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Điều hướng">
        <Sidebar items={sidebarItems} activeHref={pathname} LinkComponent={SidebarLink} />
        <div className="mt-auto border-t border-line-glass pt-4 sm:hidden">
          <LocaleSwitcherWidget />
        </div>
      </MobileNavDrawer>
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

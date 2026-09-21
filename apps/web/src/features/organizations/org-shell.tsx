'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useOrganization } from '@pmtool/api-client';
import { cn, MobileNavDrawer, Sidebar, ThemeSwitcher, TopBar } from '@pmtool/ui';
import { RequireAuth } from '../auth/require-auth';
import { OrgSwitcherWidget } from '../shell/org-switcher-widget';
import { LocaleSwitcherWidget } from '../shell/locale-switcher-widget';
import { UserMenu } from '../shell/user-menu';
import { Link, useRouter, usePathname } from '../../i18n/navigation';
import { NotificationBell } from '../shell/notification-bell';
import { CommandPalette } from '../command-palette/command-palette';

function SidebarLink({
  href,
  className,
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} title={title}>
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

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

function MyTasksIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6Z" />
    </svg>
  );
}

function LeaderboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 21V10M14 21V3M20 21v-7M4 21h16" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
    </svg>
  );
}

const SIDEBAR_COLLAPSED_KEY = 'pmtool:sidebar-collapsed';

function OrgGate({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const org = useOrganization(orgSlug);
  const tNav = useTranslations('nav');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (org.isError) {
      router.replace('/onboarding/create-organization');
    }
  }, [org.isError, router]);

  // Close the drawer on every navigation so it doesn't stay open after tapping a link.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Read the collapse preference once on mount, not a lazy useState
  // initializer — localStorage isn't available during SSR, so the state
  // must default to expanded and only pick up the stored value once
  // mounted (same "flash to correct state on mount" tradeoff the mounted-
  // guard in GanttChart.tsx already makes). Persisting happens directly in
  // toggleCollapsed below, not in a reactive [collapsed]-keyed effect — that
  // would also fire on this very first mount (before the read above commits)
  // and overwrite the just-read stored value back to the stale default.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
    } catch {
      // Private-window/blocked storage — stay expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore — collapse state just won't persist this session.
      }
      return next;
    });
  }

  if (org.isLoading || org.isError || !org.data) {
    return null;
  }

  const sidebarItems = [
    { href: `/${orgSlug}/dashboard`, label: 'Dashboard', icon: <DashboardIcon /> },
    { href: `/${orgSlug}/my-tasks`, label: tNav('myTasks'), icon: <MyTasksIcon /> },
    { href: `/${orgSlug}/projects`, label: tNav('projects'), icon: <ProjectsIcon /> },
    { href: `/${orgSlug}/leaderboard`, label: tNav('leaderboard'), icon: <LeaderboardIcon /> },
    { href: `/${orgSlug}/settings`, label: tNav('orgSettings'), icon: <SettingsIcon /> },
  ];
  const archived = org.data.status === 'ARCHIVED';

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col glass-bar p-4 md:flex print:hidden',
          collapsed ? 'w-16' : 'w-56',
        )}
      >
        {/* Top, not bottom: the floating mascot companion (apps/web/src/features/shell/mascot-companion.tsx)
            deliberately sits fixed bottom-left on every authenticated page — a bottom-of-sidebar
            toggle would land in that exact corner and get its clicks swallowed (caught live via
            the E2E test for this feature, which failed with "intercepts pointer events" until this
            moved). */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? tNav('expandSidebar') : tNav('collapseSidebar')}
          title={collapsed ? tNav('expandSidebar') : tNav('collapseSidebar')}
          className={cn(
            'mb-2 flex h-9 items-center gap-2 rounded-md text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary',
            collapsed ? 'w-9 justify-center self-center' : 'w-full px-3',
          )}
        >
          <CollapseIcon collapsed={collapsed} />
          {!collapsed && <span className="text-sm">{tNav('collapseSidebar')}</span>}
        </button>
        <Sidebar items={sidebarItems} activeHref={pathname} LinkComponent={SidebarLink} collapsed={collapsed} />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar
          className="print:hidden"
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
              <CommandPalette orgSlug={orgSlug} />
              <NotificationBell orgSlug={orgSlug} />
              <div className="hidden sm:block">
                <LocaleSwitcherWidget />
              </div>
              <ThemeSwitcher />
              <UserMenu />
            </>
          }
        />
        {archived && (
          <div className="border-b border-line-glass bg-surface-subtle px-6 py-2 text-sm text-ink-secondary">
            {tNav('archivedBanner')}
          </div>
        )}
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

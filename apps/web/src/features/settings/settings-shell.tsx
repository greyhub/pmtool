'use client';

import type { ReactNode } from 'react';
import { ThemeSwitcher, TopBar } from '@pmtool/ui';
import { RequireAuth } from '../auth/require-auth';
import { LocaleSwitcherWidget } from '../shell/locale-switcher-widget';
import { UserMenu } from '../shell/user-menu';

export function SettingsShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen flex-col">
        <TopBar
          left={<span className="font-semibold text-ink-primary">{title}</span>}
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
        <main className="mx-auto w-full max-w-2xl flex-1 p-6">{children}</main>
      </div>
    </RequireAuth>
  );
}

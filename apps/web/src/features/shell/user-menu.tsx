'use client';

import { useEffect, useRef, useState } from 'react';
import { useMe, useLogout } from '@pmtool/api-client';
import { Avatar } from '@pmtool/ui';
import { Link, useRouter } from '../../i18n/navigation';

export function UserMenu() {
  const { data: user } = useMe();
  const logout = useLogout();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu tài khoản (${user.fullName})`}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-48 glass-strong rounded-md py-1"
        >
          <div className="px-3 py-2 text-sm text-ink-secondary">{user.email}</div>
          <div className="my-1 border-t border-line-glass" />
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-primary hover:bg-surface-subtle"
          >
            Cài đặt
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout.mutate(undefined, { onSuccess: () => router.push('/login') });
            }}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-primary hover:bg-surface-subtle"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

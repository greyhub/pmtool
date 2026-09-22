'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useMe, useLogout } from '@pmtool/api-client';
import { useAnchoredMenu } from '../../lib/use-anchored-menu';
import { UserAvatar } from '../people/user-avatar';
import { Link, useRouter } from '../../i18n/navigation';

const MENU_WIDTH = 192; // w-48

export function UserMenu({ feedbackOrgSlug }: { feedbackOrgSlug?: string } = {}) {
  const tNav = useTranslations('nav');
  const { data: user } = useMe();
  const logout = useLogout();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pos = useAnchoredMenu(
    open,
    btnRef,
    (box) => ({ left: box.right - MENU_WIDTH, top: box.bottom + 4 }),
    () => setOpen(false),
  );

  if (!user) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu tài khoản (${user.fullName})`}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <UserAvatar userId={user.id} name={user.fullName} character={user.mascotCharacter} />
      </button>

      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Portaled: this menu sits inside a glass topbar, whose backdrop-filter creates its own
                stacking context — a plain absolute dropdown would paint behind whatever the page renders
                next (main content), no matter its z-index, since z-index only competes within the same
                stacking context. Same fix, same reason, as assignees-editor.tsx's MemberPicker. */}
            <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
            <div
              role="menu"
              className="fixed z-50 rounded-md glass-strong py-1"
              style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
            >
              <div className="px-3 py-2 text-sm text-ink-secondary">{user.email}</div>
              <div className="my-1 border-t border-line-glass" />
              <Link
                href={feedbackOrgSlug ? `/feedback?org=${feedbackOrgSlug}` : '/feedback'}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-ink-primary hover:bg-surface-subtle"
              >
                {tNav('feedback')}
              </Link>
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
          </>,
          document.body,
        )}
    </div>
  );
}

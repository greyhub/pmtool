'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@pmtool/api-client';
import type { NotificationDto } from '@pmtool/shared-types';
import { Link } from '../../i18n/navigation';
import { formatRelativeTime } from '../../lib/relative-time';

function hrefOf(orgSlug: string, n: NotificationDto): string {
  return n.entityKind === 'deliverable'
    ? `/${orgSlug}/projects/${n.projectKey}/deliverables`
    : `/${orgSlug}/projects/${n.projectKey}/tasks/${n.entityId}`;
}

/** The bell in the top bar: unread count, and a list of what happened around me. */
export function NotificationBell({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const { data } = useNotifications(orgSlug);
  const markRead = useMarkNotificationRead(orgSlug);
  const markAll = useMarkAllNotificationsRead(orgSlug);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.unreadCount ?? 0;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? t('bellUnread', { count: unread }) : t('bell')}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span
            data-testid="notification-count"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>
            <button
              type="button"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="text-xs font-medium text-action-primary hover:underline disabled:text-ink-muted disabled:no-underline"
            >
              {t('markAll')}
            </button>
          </div>
          {!data || data.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-secondary">{t('empty')}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={hrefOf(orgSlug, n)}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setOpen(false);
                    }}
                    className={`flex gap-3 px-4 py-3 hover:bg-surface-subtle ${n.read ? '' : 'bg-action-primary/5'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-action-primary'}`}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block text-ink-primary">
                        {t(`types.${n.type}` as never, { actor: n.actorName ?? t('someone'), title: n.entityTitle })}
                      </span>
                      {n.detail && (
                        <span className="mt-0.5 block truncate text-xs text-ink-secondary">“{n.detail}”</span>
                      )}
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {formatRelativeTime(n.createdAt, locale)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

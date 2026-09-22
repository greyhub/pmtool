'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useOrgLoginHistory } from '@pmtool/api-client';
import { Badge } from '@pmtool/ui';
import { formatRelativeTime } from '../../lib/relative-time';
import { DeviceLabel } from './device-label';

/** Every login by every current member of the org — the audit page's "Đăng nhập" tab, owners/admins only. */
export function OrgLoginHistoryList({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('presence.orgLoginHistory');
  const tMethods = useTranslations('presence.methods');
  const locale = useLocale();
  const { data: events } = useOrgLoginHistory(orgSlug, true);

  if (!events || events.length === 0) {
    return <p className="p-6 text-center text-sm text-ink-secondary">{t('empty')}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-line-glass">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink-primary">
              {e.user?.fullName ?? e.user?.email}
            </span>
            <Badge variant="neutral">{tMethods(e.method)}</Badge>
            <span className="text-ink-secondary">
              <DeviceLabel userAgent={e.userAgent} />
            </span>
            {e.ip && <span className="font-mono text-xs text-ink-muted">{e.ip}</span>}
          </span>
          <span className="text-xs text-ink-muted">{formatRelativeTime(e.createdAt, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

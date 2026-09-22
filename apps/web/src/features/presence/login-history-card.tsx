'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMyLoginHistory } from '@pmtool/api-client';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';
import { formatRelativeTime } from '../../lib/relative-time';
import { DeviceLabel } from './device-label';

export function LoginHistoryCard() {
  const t = useTranslations('presence.loginHistory');
  const tMethods = useTranslations('presence.methods');
  const locale = useLocale();
  const { data: events } = useMyLoginHistory();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-ink-secondary">{t('subtitle')}</p>
        {!events || events.length === 0 ? (
          <p className="text-sm text-ink-secondary">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-glass">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="neutral">{tMethods(e.method)}</Badge>
                  <span className="text-ink-secondary">
                    <DeviceLabel userAgent={e.userAgent} />
                  </span>
                  {e.ip && <span className="font-mono text-xs text-ink-muted">{e.ip}</span>}
                </span>
                <span className="text-xs text-ink-muted">
                  {formatRelativeTime(e.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

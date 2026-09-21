'use client';

import { useTranslations } from 'next-intl';
import { useOrgActivity } from '@pmtool/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';
import { UserAvatar } from '../people/user-avatar';

export function ActivityFeed({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('activity.feed');
  const tEntity = useTranslations('activity.entity');
  const tAction = useTranslations('activity.action');
  const { data: logs, isLoading } = useOrgActivity(orgSlug);

  if (isLoading) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!logs || logs.length === 0 ? (
          <p className="text-sm text-ink-secondary">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {logs.map((log) => {
              const title = typeof log.metadata?.title === 'string' ? log.metadata.title : undefined;
              return (
                <li key={log.id} className="flex items-start gap-3 text-sm">
                  <span aria-hidden="true">
                    <UserAvatar userId={log.actor.id} name={log.actor.fullName} />
                  </span>
                  <p className="text-ink-secondary">
                    <span className="font-medium text-ink-primary">{log.actor.fullName}</span>{' '}
                    {tAction(log.action)} {tEntity(log.entityType)}
                    {title && <span className="text-ink-primary">: {title}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

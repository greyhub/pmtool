'use client';

import { useTranslations } from 'next-intl';
import { useMyGamificationStats } from '@pmtool/api-client';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';

export function GamificationSummaryCard({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('gamification.myStats');
  const tBadges = useTranslations('gamification.badges');
  const { data: stats, isLoading } = useMyGamificationStats(orgSlug);

  if (isLoading || !stats) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t('title')}</CardTitle>
        <Link href={`/${orgSlug}/leaderboard`} className="text-sm text-ink-secondary hover:underline">
          {t('viewLeaderboard')}
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-ink-muted">{t('points')}</p>
            <p className="text-2xl font-semibold text-ink-primary">{stats.totalPoints}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t('streak')}</p>
            <p className="text-2xl font-semibold text-ink-primary">{stats.currentStreakDays}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t('badges')}</p>
            <p className="text-2xl font-semibold text-ink-primary">{stats.badges.length}</p>
          </div>
        </div>

        {stats.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.badges.map((b) => (
              <Badge key={b.badgeKey} variant="primary" title={tBadges(`${b.badgeKey}.description`)}>
                {tBadges(`${b.badgeKey}.name`)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

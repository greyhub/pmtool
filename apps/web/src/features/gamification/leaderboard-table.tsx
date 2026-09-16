'use client';

import { useTranslations } from 'next-intl';
import { useLeaderboard } from '@pmtool/api-client';
import { Avatar, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@pmtool/ui';

export function LeaderboardTable({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('gamification.leaderboard');
  const { data: entries, isLoading } = useLeaderboard(orgSlug);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
      <p className="text-sm text-ink-secondary">{t('subtitle')}</p>

      <Card className="mt-6">
        {isLoading ? null : entries && entries.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('columnRank')}</TableHeaderCell>
                <TableHeaderCell>{t('columnMember')}</TableHeaderCell>
                <TableHeaderCell>{t('columnPoints')}</TableHeaderCell>
                <TableHeaderCell>{t('columnStreak')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.userId}>
                  <TableCell className="font-mono text-xs text-ink-muted">#{entry.rank}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar name={entry.fullName} src={entry.avatarUrl} size="sm" />
                      {entry.fullName}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold">{entry.totalPoints}</TableCell>
                  <TableCell>
                    {entry.currentStreakDays > 0 ? t('streakDays', { count: entry.currentStreakDays }) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>
    </div>
  );
}

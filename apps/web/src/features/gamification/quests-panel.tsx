'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { gamificationKeys, useMyQuests } from '@pmtool/api-client';
import { Badge, Card } from '@pmtool/ui';

export function QuestsPanel({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('gamification.quests');
  const queryClient = useQueryClient();
  const { data: quests, isLoading } = useMyQuests(orgSlug);

  // Fetching quests can award bonus points as a side effect (the two
  // due-task quests are evaluated on read — see GamificationService.
  // getMyQuests). Without this, the leaderboard/points-summary queries
  // (fetched in parallel, not sequenced after this one) can render a
  // stale total that only catches up on the next manual reload —
  // confirmed live: the leaderboard showed 20 points immediately after a
  // quest completion that had just awarded 45 more, only becoming 65
  // after a reload. Invalidating here whenever quests data changes closes
  // that gap without needing this GET to double as a mutation.
  useEffect(() => {
    if (!quests) return;
    queryClient.invalidateQueries({ queryKey: gamificationKeys.leaderboard(orgSlug) });
    queryClient.invalidateQueries({ queryKey: gamificationKeys.me(orgSlug) });
  }, [quests, queryClient, orgSlug]);

  if (isLoading || !quests || quests.length === 0) return null;

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-ink-secondary">{t('title')}</h2>
      <div className="mt-4 flex flex-col gap-4">
        {quests.map((quest) => {
          const percent =
            quest.target === 0 ? 0 : Math.round((quest.progress / quest.target) * 100);
          return (
            <div key={quest.questKey} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-primary">
                  {t(`${quest.questKey}.name`)}
                </span>
                <Badge variant={quest.completed ? 'success' : 'neutral'}>
                  {quest.completed ? t('completed') : `+${quest.points}`}
                </Badge>
              </div>
              <p className="text-xs text-ink-secondary">{t(`${quest.questKey}.description`)}</p>
              {quest.target === 0 ? (
                <p className="text-xs text-ink-muted">{t('nothingDue')}</p>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full bg-action-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-ink-muted">
                    {quest.progress}/{quest.target}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { QuestsPanel } from '../../../../features/gamification/quests-panel';
import { LeaderboardTable } from '../../../../features/gamification/leaderboard-table';

export default function LeaderboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return (
    <div className="flex flex-col gap-6">
      <QuestsPanel orgSlug={orgSlug} />
      <LeaderboardTable orgSlug={orgSlug} />
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { LeaderboardTable } from '../../../../features/gamification/leaderboard-table';

export default function LeaderboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <LeaderboardTable orgSlug={orgSlug} />;
}

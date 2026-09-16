import { useQuery } from '@tanstack/react-query';
import type { LeaderboardEntryDto, MyGamificationStatsDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const gamificationKeys = {
  leaderboard: (orgSlug: string) => ['organizations', orgSlug, 'gamification', 'leaderboard'] as const,
  me: (orgSlug: string) => ['organizations', orgSlug, 'gamification', 'me'] as const,
};

export function useLeaderboard(orgSlug: string | undefined) {
  return useQuery({
    queryKey: gamificationKeys.leaderboard(orgSlug ?? ''),
    queryFn: () => apiRequest<LeaderboardEntryDto[]>(`/api/v1/organizations/${orgSlug}/gamification/leaderboard`),
    enabled: Boolean(orgSlug),
  });
}

export function useMyGamificationStats(orgSlug: string | undefined) {
  return useQuery({
    queryKey: gamificationKeys.me(orgSlug ?? ''),
    queryFn: () => apiRequest<MyGamificationStatsDto>(`/api/v1/organizations/${orgSlug}/gamification/me`),
    enabled: Boolean(orgSlug),
  });
}

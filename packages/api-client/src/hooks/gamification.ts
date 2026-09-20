import { useQuery } from '@tanstack/react-query';
import type { LeaderboardEntryDto, MyGamificationStatsDto, QuestDto } from '@pmtool/shared-types';
import { apiRequest } from '../http-client';

export const gamificationKeys = {
  leaderboard: (orgSlug: string) => ['organizations', orgSlug, 'gamification', 'leaderboard'] as const,
  me: (orgSlug: string) => ['organizations', orgSlug, 'gamification', 'me'] as const,
  quests: (orgSlug: string) => ['organizations', orgSlug, 'gamification', 'quests'] as const,
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

export function useMyQuests(orgSlug: string | undefined) {
  return useQuery({
    queryKey: gamificationKeys.quests(orgSlug ?? ''),
    queryFn: () => apiRequest<QuestDto[]>(`/api/v1/organizations/${orgSlug}/gamification/quests`),
    enabled: Boolean(orgSlug),
  });
}

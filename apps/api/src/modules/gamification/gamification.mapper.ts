import { User, UserBadge, UserScore } from '@prisma/client';
import {
  BadgeKey,
  LeaderboardEntryDto,
  MyGamificationStatsDto,
} from '@pmtool/shared-types';

type LeaderboardRow = UserScore & {
  rank: number;
  user: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
};

export function toLeaderboardEntryDto(
  row: LeaderboardRow,
): LeaderboardEntryDto {
  return {
    userId: row.user.id,
    fullName: row.user.fullName,
    avatarUrl: row.user.avatarUrl,
    totalPoints: row.totalPoints,
    currentStreakDays: row.currentStreakDays,
    rank: row.rank,
  };
}

export function toMyGamificationStatsDto(
  score: UserScore | null,
  badges: UserBadge[],
): MyGamificationStatsDto {
  return {
    totalPoints: score?.totalPoints ?? 0,
    currentStreakDays: score?.currentStreakDays ?? 0,
    longestStreakDays: score?.longestStreakDays ?? 0,
    badges: badges.map((b) => ({
      badgeKey: b.badgeKey as BadgeKey,
      earnedAt: b.earnedAt.toISOString(),
    })),
  };
}

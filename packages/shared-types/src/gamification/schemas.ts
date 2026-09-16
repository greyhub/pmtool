import { z } from 'zod';
import { BADGE_KEYS } from '../common/enums';

export const leaderboardEntrySchema = z.object({
  userId: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  totalPoints: z.number(),
  currentStreakDays: z.number(),
  rank: z.number(),
});
export type LeaderboardEntryDto = z.infer<typeof leaderboardEntrySchema>;

const earnedBadgeSchema = z.object({
  badgeKey: z.enum(BADGE_KEYS),
  earnedAt: z.string(),
});
export type EarnedBadgeDto = z.infer<typeof earnedBadgeSchema>;

export const myGamificationStatsSchema = z.object({
  totalPoints: z.number(),
  currentStreakDays: z.number(),
  longestStreakDays: z.number(),
  badges: z.array(earnedBadgeSchema),
});
export type MyGamificationStatsDto = z.infer<typeof myGamificationStatsSchema>;

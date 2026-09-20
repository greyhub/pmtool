import { z } from 'zod';
import { BADGE_KEYS, QUEST_KEYS, QUEST_SCOPES } from '../common/enums';

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

export const questSchema = z.object({
  questKey: z.enum(QUEST_KEYS),
  scope: z.enum(QUEST_SCOPES),
  progress: z.number(),
  target: z.number(),
  points: z.number(),
  completed: z.boolean(),
});
export type QuestDto = z.infer<typeof questSchema>;

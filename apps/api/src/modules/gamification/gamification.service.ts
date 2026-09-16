import { Injectable } from '@nestjs/common';
import { UserScore } from '@prisma/client';
import { BadgeKey } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { vnDateKey, vnDayGap } from './streak-date.util';

const USER_SELECT = { id: true, fullName: true, avatarUrl: true } as const;
const LEADERBOARD_TAKE = 20;

export type AwardReason =
  'task_created' | 'task_completed' | 'risk_resolved' | 'comment_created';

type CounterField =
  | 'tasksCreatedCount'
  | 'tasksCompletedCount'
  | 'risksResolvedCount'
  | 'commentsCount';

const REASON_COUNTER_FIELD: Record<AwardReason, CounterField> = {
  task_created: 'tasksCreatedCount',
  task_completed: 'tasksCompletedCount',
  risk_resolved: 'risksResolvedCount',
  comment_created: 'commentsCount',
};

const BADGE_DEFINITIONS: {
  key: BadgeKey;
  check: (score: UserScore) => boolean;
}[] = [
  { key: 'FIRST_TASK', check: (s) => s.tasksCreatedCount >= 1 },
  { key: 'STREAK_7', check: (s) => s.currentStreakDays >= 7 },
  { key: 'STREAK_30', check: (s) => s.currentStreakDays >= 30 },
  { key: 'RISK_RESOLVER', check: (s) => s.risksResolvedCount >= 5 },
  { key: 'TASK_MACHINE', check: (s) => s.tasksCompletedCount >= 50 },
  { key: 'TEAM_PLAYER', check: (s) => s.commentsCount >= 20 },
];

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called explicitly by TasksService/RisksService/CommentsService at specific
   * meaningful transitions (never generically off every mutation — see
   * AuditLogInterceptor for that path, which serves the separate audit feed).
   */
  async awardPoints(
    organizationId: string,
    userId: string,
    points: number,
    reason: AwardReason,
  ): Promise<void> {
    const today = vnDateKey();
    const existing = await this.prisma.db.userScore.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });

    let currentStreakDays = 1;
    if (existing?.lastActivityDate) {
      const gap = vnDayGap(vnDateKey(existing.lastActivityDate), today);
      if (gap === 0) {
        currentStreakDays = existing.currentStreakDays;
      } else if (gap === 1) {
        currentStreakDays = existing.currentStreakDays + 1;
      }
      // any bigger gap (or a negative gap, which shouldn't happen but is handled the same way) resets to 1
    }
    const longestStreakDays = Math.max(
      existing?.longestStreakDays ?? 0,
      currentStreakDays,
    );
    const counterField = REASON_COUNTER_FIELD[reason];

    const score = await this.prisma.db.userScore.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      // The tenant-scoping extension does NOT auto-inject organizationId into
      // upsert's `create` branch (only into `where`, for matching) — must be
      // explicit here or this silently creates an unscoped row.
      create: {
        organizationId,
        userId,
        totalPoints: points,
        currentStreakDays,
        longestStreakDays,
        lastActivityDate: new Date(),
        [counterField]: 1,
      },
      update: {
        totalPoints: { increment: points },
        currentStreakDays,
        longestStreakDays,
        lastActivityDate: new Date(),
        [counterField]: { increment: 1 },
      },
    });

    await this.checkAndAwardBadges(score);
  }

  private async checkAndAwardBadges(score: UserScore): Promise<void> {
    const qualifying = BADGE_DEFINITIONS.filter((b) => b.check(score)).map(
      (b) => b.key,
    );
    if (qualifying.length === 0) return;

    await this.prisma.db.userBadge.createMany({
      data: qualifying.map((badgeKey) => ({
        organizationId: score.organizationId,
        userId: score.userId,
        badgeKey,
      })),
      skipDuplicates: true,
    });
  }

  async getLeaderboard(organizationId: string, limit = LEADERBOARD_TAKE) {
    const rows = await this.prisma.db.userScore.findMany({
      where: { organizationId },
      orderBy: { totalPoints: 'desc' },
      take: limit,
      include: { user: { select: USER_SELECT } },
    });
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async getMyStats(organizationId: string, userId: string) {
    const [score, badges] = await Promise.all([
      this.prisma.db.userScore.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      }),
      this.prisma.db.userBadge.findMany({
        where: { organizationId, userId },
        orderBy: { earnedAt: 'asc' },
      }),
    ]);
    return { score, badges };
  }
}

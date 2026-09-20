import { Injectable } from '@nestjs/common';
import { UserQuestProgress, UserScore } from '@prisma/client';
import { BadgeKey, QuestKey, QuestScope } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  vnDateKey,
  vnDayGap,
  vnDayRangeUtc,
  vnWeekRangeUtc,
  vnWeekStartKey,
} from './streak-date.util';

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

// Fixed, code-defined quest catalog — not a DB-editable table, per the plan's
// "same 4 quests every period" decision. DAILY_DUE_TASKS/WEEKLY_DUE_TASKS have
// no fixed target here since it's computed live from each user's own tasks.
const QUEST_POINTS: Record<QuestKey, number> = {
  DAILY_DUE_TASKS: 15,
  WEEKLY_DUE_TASKS: 30,
  DAILY_PROGRESS_UPDATE: 5,
  DAILY_LOGIN: 5,
};

export interface QuestView {
  questKey: QuestKey;
  scope: QuestScope;
  progress: number;
  target: number;
  points: number;
  completed: boolean;
}

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
    const score = await this.applyPointsAndStreak(
      organizationId,
      userId,
      points,
      REASON_COUNTER_FIELD[reason],
    );
    await this.checkAndAwardBadges(score);
  }

  /**
   * Points earned from completing a daily/weekly quest — same streak/points
   * mechanics as awardPoints (quest completion still counts as daily
   * activity), but doesn't belong to any of the 4 tracked action counters.
   */
  private async awardQuestBonus(
    organizationId: string,
    userId: string,
    points: number,
  ): Promise<void> {
    const score = await this.applyPointsAndStreak(
      organizationId,
      userId,
      points,
    );
    await this.checkAndAwardBadges(score);
  }

  private async applyPointsAndStreak(
    organizationId: string,
    userId: string,
    points: number,
    counterField?: CounterField,
  ): Promise<UserScore> {
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

    return this.prisma.db.userScore.upsert({
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
        ...(counterField ? { [counterField]: 1 } : {}),
      },
      update: {
        totalPoints: { increment: points },
        currentStreakDays,
        longestStreakDays,
        lastActivityDate: new Date(),
        ...(counterField ? { [counterField]: { increment: 1 } } : {}),
      },
    });
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

  // ---- Quests ----

  /**
   * Called from AuthService.login. Login has no :orgSlug in its route, so no
   * AsyncLocalStorage request context exists yet — the membership lookup
   * below is correctly unscoped (same mechanism the Telegram cron jobs rely
   * on) and naturally spans every org the user belongs to.
   */
  async recordLogin(userId: string): Promise<void> {
    const memberships = await this.prisma.db.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const today = vnDateKey();
    await Promise.all(
      memberships.map((m) =>
        this.trackCounterQuest(
          m.organizationId,
          userId,
          'DAILY_LOGIN',
          today,
          1,
        ),
      ),
    );
  }

  /** Called from TasksService.update when percentComplete actually changes. */
  async recordProgressUpdate(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await this.trackCounterQuest(
      organizationId,
      userId,
      'DAILY_PROGRESS_UPDATE',
      vnDateKey(),
      1,
    );
  }

  private async trackCounterQuest(
    organizationId: string,
    userId: string,
    questKey: QuestKey,
    periodKey: string,
    target: number,
  ): Promise<void> {
    const row = await this.prisma.db.userQuestProgress.upsert({
      where: {
        organizationId_userId_questKey_periodKey: {
          organizationId,
          userId,
          questKey,
          periodKey,
        },
      },
      create: { organizationId, userId, questKey, periodKey, progressCount: 1 },
      update: { progressCount: { increment: 1 } },
    });
    if (!row.completedAt && row.progressCount >= target) {
      await this.prisma.db.userQuestProgress.update({
        where: { id: row.id },
        data: { completedAt: new Date() },
      });
      await this.awardQuestBonus(
        organizationId,
        userId,
        QUEST_POINTS[questKey],
      );
    }
  }

  /**
   * For the two live-computed due-task quests: syncs the stored progress to
   * the live count and awards the bonus the first time target is met.
   * Returns null when there's nothing to show (no tasks due this period).
   */
  private async evaluateDueTasksQuest(
    organizationId: string,
    userId: string,
    questKey: QuestKey,
    periodKey: string,
    target: number,
    currentProgress: number,
  ): Promise<UserQuestProgress | null> {
    if (target === 0) return null;

    const key = {
      organizationId_userId_questKey_periodKey: {
        organizationId,
        userId,
        questKey,
        periodKey,
      },
    };
    const existing = await this.prisma.db.userQuestProgress.findUnique({
      where: key,
    });

    let row: UserQuestProgress;
    if (!existing) {
      row = await this.prisma.db.userQuestProgress.create({
        data: {
          organizationId,
          userId,
          questKey,
          periodKey,
          progressCount: currentProgress,
        },
      });
    } else if (existing.progressCount !== currentProgress) {
      row = await this.prisma.db.userQuestProgress.update({
        where: key,
        data: { progressCount: currentProgress },
      });
    } else {
      row = existing;
    }

    if (!row.completedAt && currentProgress >= target) {
      row = await this.prisma.db.userQuestProgress.update({
        where: key,
        data: { completedAt: new Date() },
      });
      await this.awardQuestBonus(
        organizationId,
        userId,
        QUEST_POINTS[questKey],
      );
    }
    return row;
  }

  async getMyQuests(
    organizationId: string,
    userId: string,
  ): Promise<QuestView[]> {
    const today = vnDateKey();
    const weekStart = vnWeekStartKey();
    const { start: todayStart, end: todayEnd } = vnDayRangeUtc(today);
    const { start: weekStartUtc, end: weekEndUtc } = vnWeekRangeUtc(weekStart);

    const [dueToday, dueWeek, loginRow, progressRow] = await Promise.all([
      this.prisma.db.task.findMany({
        where: {
          organizationId,
          assignees: { some: { userId } },
          dueDate: { gte: todayStart, lt: todayEnd },
        },
        select: { status: true },
      }),
      this.prisma.db.task.findMany({
        where: {
          organizationId,
          assignees: { some: { userId } },
          dueDate: { gte: weekStartUtc, lt: weekEndUtc },
        },
        select: { status: true },
      }),
      this.prisma.db.userQuestProgress.findUnique({
        where: {
          organizationId_userId_questKey_periodKey: {
            organizationId,
            userId,
            questKey: 'DAILY_LOGIN',
            periodKey: today,
          },
        },
      }),
      this.prisma.db.userQuestProgress.findUnique({
        where: {
          organizationId_userId_questKey_periodKey: {
            organizationId,
            userId,
            questKey: 'DAILY_PROGRESS_UPDATE',
            periodKey: today,
          },
        },
      }),
    ]);

    const dueTodayTarget = dueToday.length;
    const dueTodayDone = dueToday.filter((t) => t.status === 'DONE').length;
    const dueWeekTarget = dueWeek.length;
    const dueWeekDone = dueWeek.filter((t) => t.status === 'DONE').length;

    const [dueTodayRow, dueWeekRow] = await Promise.all([
      this.evaluateDueTasksQuest(
        organizationId,
        userId,
        'DAILY_DUE_TASKS',
        today,
        dueTodayTarget,
        dueTodayDone,
      ),
      this.evaluateDueTasksQuest(
        organizationId,
        userId,
        'WEEKLY_DUE_TASKS',
        weekStart,
        dueWeekTarget,
        dueWeekDone,
      ),
    ]);

    const quests: QuestView[] = [];
    if (dueTodayRow) {
      quests.push(
        toQuestView('DAILY_DUE_TASKS', 'daily', dueTodayTarget, dueTodayRow),
      );
    }
    quests.push(toQuestView('DAILY_LOGIN', 'daily', 1, loginRow));
    quests.push(toQuestView('DAILY_PROGRESS_UPDATE', 'daily', 1, progressRow));
    if (dueWeekRow) {
      quests.push(
        toQuestView('WEEKLY_DUE_TASKS', 'weekly', dueWeekTarget, dueWeekRow),
      );
    }
    return quests;
  }
}

function toQuestView(
  questKey: QuestKey,
  scope: QuestScope,
  target: number,
  row: UserQuestProgress | null,
): QuestView {
  return {
    questKey,
    scope,
    target,
    progress: Math.min(row?.progressCount ?? 0, target),
    points: QUEST_POINTS[questKey],
    completed: row?.completedAt != null,
  };
}

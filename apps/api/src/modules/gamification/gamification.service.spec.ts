import { GamificationService } from './gamification.service';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeScore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'score_1',
    organizationId: 'org_1',
    userId: 'user_1',
    totalPoints: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastActivityDate: null,
    tasksCreatedCount: 0,
    tasksCompletedCount: 0,
    risksResolvedCount: 0,
    commentsCount: 0,
    ...overrides,
  };
}

describe('GamificationService.awardPoints', () => {
  let prisma: {
    db: {
      userScore: {
        findUnique: ReturnType<typeof vi.fn>;
        upsert: ReturnType<typeof vi.fn>;
      };
      userBadge: {
        createMany: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: GamificationService;

  beforeEach(() => {
    prisma = {
      db: {
        userScore: { findUnique: vi.fn(), upsert: vi.fn() },
        userBadge: { createMany: vi.fn() },
      },
    };
    service = new GamificationService(prisma as unknown as PrismaService);
  });

  it('starts a new streak at 1 for a user with no existing score', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(null);
    prisma.db.userScore.upsert.mockResolvedValue(
      makeScore({ currentStreakDays: 1, longestStreakDays: 1 }),
    );

    await service.awardPoints('org_1', 'user_1', 5, 'task_created');

    expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationId: 'org_1',
          currentStreakDays: 1,
          longestStreakDays: 1,
          tasksCreatedCount: 1,
        }),
      }),
    );
  });

  it('leaves the streak unchanged for a second award on the same VN calendar day', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(
      makeScore({
        currentStreakDays: 3,
        longestStreakDays: 5,
        lastActivityDate: new Date(),
      }),
    );
    prisma.db.userScore.upsert.mockResolvedValue(makeScore());

    await service.awardPoints('org_1', 'user_1', 5, 'task_created');

    expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          currentStreakDays: 3,
          longestStreakDays: 5,
        }),
      }),
    );
  });

  it('increments the streak for an award exactly one VN calendar day later', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(
      makeScore({
        currentStreakDays: 3,
        longestStreakDays: 5,
        lastActivityDate: new Date(Date.now() - DAY_MS),
      }),
    );
    prisma.db.userScore.upsert.mockResolvedValue(makeScore());

    await service.awardPoints('org_1', 'user_1', 5, 'task_created');

    expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          currentStreakDays: 4,
          longestStreakDays: 5,
        }),
      }),
    );
  });

  it('resets the streak to 1 after a gap of more than one day', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(
      makeScore({
        currentStreakDays: 5,
        longestStreakDays: 5,
        lastActivityDate: new Date(Date.now() - 3 * DAY_MS),
      }),
    );
    prisma.db.userScore.upsert.mockResolvedValue(makeScore());

    await service.awardPoints('org_1', 'user_1', 5, 'task_created');

    expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          currentStreakDays: 1,
          longestStreakDays: 5,
        }),
      }),
    );
  });

  it('tracks longestStreakDays as the max ever reached, not reduced by a later reset', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(
      makeScore({
        currentStreakDays: 10,
        longestStreakDays: 10,
        lastActivityDate: new Date(Date.now() - 3 * DAY_MS),
      }),
    );
    prisma.db.userScore.upsert.mockResolvedValue(makeScore());

    await service.awardPoints('org_1', 'user_1', 5, 'task_created');

    expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          currentStreakDays: 1,
          longestStreakDays: 10,
        }),
      }),
    );
  });

  it('increments the correct per-reason counter', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(null);
    prisma.db.userScore.upsert.mockResolvedValue(makeScore());

    await service.awardPoints('org_1', 'user_1', 15, 'risk_resolved');

    expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ risksResolvedCount: 1 }),
        update: expect.objectContaining({
          risksResolvedCount: { increment: 1 },
        }),
      }),
    );
  });

  it('awards a badge exactly once when a threshold is crossed', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(
      makeScore({ currentStreakDays: 6 }),
    );
    prisma.db.userScore.upsert.mockResolvedValue(
      makeScore({ currentStreakDays: 7 }),
    );

    await service.awardPoints('org_1', 'user_1', 5, 'task_created');

    expect(prisma.db.userBadge.createMany).toHaveBeenCalledWith({
      data: [
        { organizationId: 'org_1', userId: 'user_1', badgeKey: 'STREAK_7' },
      ],
      skipDuplicates: true,
    });
  });

  it('does not touch userBadge when no badge threshold is met', async () => {
    prisma.db.userScore.findUnique.mockResolvedValue(makeScore());
    prisma.db.userScore.upsert.mockResolvedValue(
      makeScore({ currentStreakDays: 1, tasksCreatedCount: 0 }),
    );

    await service.awardPoints('org_1', 'user_1', 5, 'comment_created');

    expect(prisma.db.userBadge.createMany).not.toHaveBeenCalled();
  });
});

function makeQuestRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'quest_1',
    organizationId: 'org_1',
    userId: 'user_1',
    questKey: 'DAILY_LOGIN',
    periodKey: '2026-03-10',
    progressCount: 0,
    completedAt: null,
    ...overrides,
  };
}

describe('GamificationService quests', () => {
  let prisma: {
    db: {
      userScore: {
        findUnique: ReturnType<typeof vi.fn>;
        upsert: ReturnType<typeof vi.fn>;
      };
      userBadge: { createMany: ReturnType<typeof vi.fn> };
      membership: { findMany: ReturnType<typeof vi.fn> };
      userQuestProgress: {
        upsert: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      task: { findMany: ReturnType<typeof vi.fn> };
    };
  };
  let service: GamificationService;

  beforeEach(() => {
    prisma = {
      db: {
        userScore: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue(makeScore()),
        },
        userBadge: { createMany: vi.fn() },
        membership: { findMany: vi.fn() },
        userQuestProgress: {
          upsert: vi.fn(),
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
        task: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };
    service = new GamificationService(prisma as unknown as PrismaService);
  });

  describe('recordLogin', () => {
    it('tracks the DAILY_LOGIN quest for every org the user belongs to', async () => {
      prisma.db.membership.findMany.mockResolvedValue([
        { organizationId: 'org_1' },
        { organizationId: 'org_2' },
      ]);
      prisma.db.userQuestProgress.upsert.mockResolvedValue(
        makeQuestRow({ progressCount: 1 }),
      );

      await service.recordLogin('user_1');

      expect(prisma.db.userQuestProgress.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.db.userQuestProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_userId_questKey_periodKey: expect.objectContaining({
              organizationId: 'org_1',
              questKey: 'DAILY_LOGIN',
            }),
          },
        }),
      );
    });

    it('awards a bonus the first time the daily target is reached', async () => {
      prisma.db.membership.findMany.mockResolvedValue([
        { organizationId: 'org_1' },
      ]);
      prisma.db.userQuestProgress.upsert.mockResolvedValue(
        makeQuestRow({ progressCount: 1, completedAt: null }),
      );

      await service.recordLogin('user_1');

      expect(prisma.db.userQuestProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { completedAt: expect.any(Date) } }),
      );
      expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ totalPoints: 5 }),
        }),
      );
    });

    it('does not re-award once already completed for the period', async () => {
      prisma.db.membership.findMany.mockResolvedValue([
        { organizationId: 'org_1' },
      ]);
      prisma.db.userQuestProgress.upsert.mockResolvedValue(
        makeQuestRow({ progressCount: 2, completedAt: new Date() }),
      );

      await service.recordLogin('user_1');

      expect(prisma.db.userQuestProgress.update).not.toHaveBeenCalled();
      expect(prisma.db.userScore.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getMyQuests', () => {
    it('omits DAILY_DUE_TASKS/WEEKLY_DUE_TASKS when nothing is due', async () => {
      prisma.db.task.findMany.mockResolvedValue([]);

      const quests = await service.getMyQuests('org_1', 'user_1');

      expect(quests.map((q) => q.questKey)).toEqual([
        'DAILY_LOGIN',
        'DAILY_PROGRESS_UPDATE',
      ]);
    });

    it('includes DAILY_DUE_TASKS with live progress when tasks are due today, without awarding early', async () => {
      prisma.db.task.findMany
        .mockResolvedValueOnce([{ status: 'DONE' }, { status: 'TODO' }]) // due today
        .mockResolvedValueOnce([]); // due this week
      prisma.db.userQuestProgress.create.mockResolvedValue(
        makeQuestRow({
          questKey: 'DAILY_DUE_TASKS',
          progressCount: 1,
          completedAt: null,
        }),
      );

      const quests = await service.getMyQuests('org_1', 'user_1');

      const dueToday = quests.find((q) => q.questKey === 'DAILY_DUE_TASKS');
      expect(dueToday).toEqual(
        expect.objectContaining({ progress: 1, target: 2, completed: false }),
      );
      expect(prisma.db.userQuestProgress.update).not.toHaveBeenCalled();
      expect(prisma.db.userScore.upsert).not.toHaveBeenCalled();
    });

    it('awards the bonus once every task due today is DONE, and marks it completed', async () => {
      prisma.db.task.findMany
        .mockResolvedValueOnce([{ status: 'DONE' }])
        .mockResolvedValueOnce([]);
      prisma.db.userQuestProgress.create.mockResolvedValue(
        makeQuestRow({
          questKey: 'DAILY_DUE_TASKS',
          progressCount: 1,
          completedAt: null,
        }),
      );
      prisma.db.userQuestProgress.update.mockResolvedValue(
        makeQuestRow({
          questKey: 'DAILY_DUE_TASKS',
          progressCount: 1,
          completedAt: new Date(),
        }),
      );

      const quests = await service.getMyQuests('org_1', 'user_1');

      expect(prisma.db.userScore.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ totalPoints: 15 }),
        }),
      );
      const dueToday = quests.find((q) => q.questKey === 'DAILY_DUE_TASKS');
      expect(dueToday?.completed).toBe(true);
    });

    it('does not re-evaluate or re-award a due-task quest already completed for the period', async () => {
      prisma.db.task.findMany
        .mockResolvedValueOnce([{ status: 'DONE' }])
        .mockResolvedValueOnce([]);
      prisma.db.userQuestProgress.findUnique.mockResolvedValue(
        makeQuestRow({
          questKey: 'DAILY_DUE_TASKS',
          progressCount: 1,
          completedAt: new Date(),
        }),
      );

      const quests = await service.getMyQuests('org_1', 'user_1');

      expect(prisma.db.userQuestProgress.create).not.toHaveBeenCalled();
      expect(prisma.db.userQuestProgress.update).not.toHaveBeenCalled();
      expect(prisma.db.userScore.upsert).not.toHaveBeenCalled();
      expect(
        quests.find((q) => q.questKey === 'DAILY_DUE_TASKS')?.completed,
      ).toBe(true);
    });
  });
});

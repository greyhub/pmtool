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

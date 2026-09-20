import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service';

function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    parentTaskId: null,
    boardColumnId: null,
    nodeType: 'ACTIVITY',
    ...overrides,
  };
}

describe('TasksService.move', () => {
  let prisma: {
    db: {
      task: {
        findUnique: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      boardColumn: { findUnique: ReturnType<typeof vi.fn> };
    };
  };
  let service: TasksService;

  beforeEach(() => {
    prisma = {
      db: {
        task: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        boardColumn: { findUnique: vi.fn() },
      },
    };
    service = new TasksService(
      prisma as unknown as PrismaService,
      {
        awardPoints: vi.fn().mockResolvedValue(undefined),
      } as unknown as GamificationService,
      {
        notifyTaskAssigned: vi.fn().mockResolvedValue(undefined),
      } as unknown as TelegramNotificationsService,
    );
  });

  it('rejects a task becoming its own parent', async () => {
    const task = makeTask();
    prisma.db.task.findUnique.mockResolvedValue(task);

    await expect(
      service.move('org_1', 't1', { parentTaskId: 't1', orderIndex: 100 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.db.task.update).not.toHaveBeenCalled();
  });

  it('rejects moving a task under its own descendant (would create a cycle)', async () => {
    // Tree: t1 -> t2 (child) -> t3 (grandchild). Moving t1 under t3 must fail.
    const t1 = makeTask({ id: 't1', parentTaskId: null });
    prisma.db.task.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 't1') return Promise.resolve(t1);
        if (where.id === 't3')
          return Promise.resolve(makeTask({ id: 't3', projectId: 'proj_1' }));
        return Promise.resolve(null);
      },
    );
    // Walking up from t3: t3 -> t2 -> t1 (found -> cycle)
    prisma.db.task.findFirst
      .mockResolvedValueOnce({ parentTaskId: 't2' }) // current = t3
      .mockResolvedValueOnce({ parentTaskId: 't1' }); // current = t2

    await expect(
      service.move('org_1', 't1', { parentTaskId: 't3', orderIndex: 100 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.db.task.update).not.toHaveBeenCalled();
  });

  it('rejects moving a task under a task from a different project', async () => {
    const t1 = makeTask({ id: 't1', projectId: 'proj_1' });
    const foreign = makeTask({ id: 't9', projectId: 'proj_OTHER' });
    prisma.db.task.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 't1') return Promise.resolve(t1);
        if (where.id === 't9') return Promise.resolve(foreign);
        return Promise.resolve(null);
      },
    );

    await expect(
      service.move('org_1', 't1', { parentTaskId: 't9', orderIndex: 100 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows a valid re-parent + reorder', async () => {
    const t1 = makeTask({ id: 't1' });
    const t5 = makeTask({
      id: 't5',
      projectId: 'proj_1',
      nodeType: 'WORK_PACKAGE',
    });
    prisma.db.task.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 't1') return Promise.resolve(t1);
        if (where.id === 't5') return Promise.resolve(t5);
        return Promise.resolve(null);
      },
    );
    prisma.db.task.findFirst.mockResolvedValue(null); // t5 has no parent -> chain ends, no cycle
    prisma.db.task.update.mockResolvedValue({
      ...t1,
      parentTaskId: 't5',
      orderIndex: 250,
    });

    const result = await service.move('org_1', 't1', {
      parentTaskId: 't5',
      orderIndex: 250,
    });

    expect(result.parentTaskId).toBe('t5');
    expect(prisma.db.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { parentTaskId: 't5', boardColumnId: undefined, orderIndex: 250 },
    });
  });

  it('promotes an ACTIVITY parent to a work package when it receives a child', async () => {
    const t1 = makeTask({ id: 't1' });
    const t5 = makeTask({ id: 't5', nodeType: 'ACTIVITY' });
    prisma.db.task.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === 't1' ? t1 : where.id === 't5' ? t5 : null),
    );
    prisma.db.task.findFirst.mockResolvedValue(null);
    prisma.db.task.update.mockResolvedValue({ ...t1, parentTaskId: 't5' });

    await service.move('org_1', 't1', { parentTaskId: 't5', orderIndex: 1 });

    expect(prisma.db.task.update).toHaveBeenCalledWith({
      where: { id: 't5' },
      data: { nodeType: 'WORK_PACKAGE' },
    });
  });

  it('rejects moving a phase under a work package', async () => {
    const t1 = makeTask({ id: 't1', nodeType: 'PHASE' });
    const t5 = makeTask({ id: 't5', nodeType: 'WORK_PACKAGE' });
    prisma.db.task.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === 't1' ? t1 : where.id === 't5' ? t5 : null),
    );
    prisma.db.task.findFirst.mockResolvedValue(null);

    await expect(
      service.move('org_1', 't1', { parentTaskId: 't5', orderIndex: 1 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.db.task.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the task belongs to a different organization', async () => {
    prisma.db.task.findUnique.mockResolvedValue(
      makeTask({ organizationId: 'org_OTHER' }),
    );

    await expect(
      service.move('org_1', 't1', { orderIndex: 1 }),
    ).rejects.toThrow(NotFoundException);
  });
});

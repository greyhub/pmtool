import { BadRequestException } from '@nestjs/common';
import { DependenciesService } from './dependencies.service';
import { PrismaService } from '../../prisma/prisma.service';

function task(id: string, projectId = 'proj_1', organizationId = 'org_1') {
  return { id, projectId, organizationId };
}

describe('DependenciesService.create', () => {
  let prisma: {
    db: {
      task: { findUnique: ReturnType<typeof vi.fn> };
      taskDependency: {
        findMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: DependenciesService;

  beforeEach(() => {
    prisma = {
      db: {
        task: { findUnique: vi.fn() },
        taskDependency: { findMany: vi.fn(), create: vi.fn() },
      },
    };
    service = new DependenciesService(prisma as unknown as PrismaService);
  });

  it('rejects a dependency where the predecessor belongs to a different project', async () => {
    prisma.db.task.findUnique
      .mockResolvedValueOnce(task('a', 'proj_OTHER'))
      .mockResolvedValueOnce(task('b'));

    await expect(
      service.create('org_1', 'proj_1', {
        predecessorId: 'a',
        successorId: 'b',
        type: 'FINISH_TO_START',
        lagDays: 0,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.db.taskDependency.create).not.toHaveBeenCalled();
  });

  it('rejects an edge that would close a cycle (B already depends transitively on A)', async () => {
    // Existing: B -> C -> A. Adding A -> B would close the cycle A -> B -> C -> A.
    prisma.db.task.findUnique
      .mockResolvedValueOnce(task('a'))
      .mockResolvedValueOnce(task('b'));
    prisma.db.taskDependency.findMany
      .mockResolvedValueOnce([{ successorId: 'c' }]) // outgoing from B
      .mockResolvedValueOnce([{ successorId: 'a' }]); // outgoing from C -> reaches A -> cycle

    await expect(
      service.create('org_1', 'proj_1', {
        predecessorId: 'a',
        successorId: 'b',
        type: 'FINISH_TO_START',
        lagDays: 0,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.db.taskDependency.create).not.toHaveBeenCalled();
  });

  it('allows a valid, acyclic dependency', async () => {
    prisma.db.task.findUnique
      .mockResolvedValueOnce(task('a'))
      .mockResolvedValueOnce(task('b'));
    prisma.db.taskDependency.findMany.mockResolvedValue([]); // B has no outgoing edges -> can never reach A
    prisma.db.taskDependency.create.mockResolvedValue({
      id: 'dep_1',
      organizationId: 'org_1',
      predecessorId: 'a',
      successorId: 'b',
      type: 'FINISH_TO_START',
      lagDays: 0,
    });

    const result = await service.create('org_1', 'proj_1', {
      predecessorId: 'a',
      successorId: 'b',
      type: 'FINISH_TO_START',
      lagDays: 0,
    });

    expect(result.id).toBe('dep_1');
    expect(prisma.db.taskDependency.create).toHaveBeenCalledOnce();
  });
});

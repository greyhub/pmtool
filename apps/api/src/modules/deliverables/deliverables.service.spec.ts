import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DeliverablesService } from './deliverables.service';
import { PrismaService } from '../../prisma/prisma.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    taskId: null,
    name: 'Báo cáo',
    description: null,
    acceptanceCriteria: null,
    status: 'PLANNED',
    url: null,
    ...overrides,
  };
}

describe('DeliverablesService', () => {
  let prisma: {
    db: {
      deliverable: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
      task: { findUnique: ReturnType<typeof vi.fn> };
    };
  };
  let service: DeliverablesService;

  beforeEach(() => {
    prisma = {
      db: {
        deliverable: {
          findUnique: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        task: { findUnique: vi.fn() },
      },
    };
    service = new DeliverablesService(prisma as unknown as PrismaService);
  });

  const updateData = () => prisma.db.deliverable.update.mock.calls[0][0].data;

  describe('submit', () => {
    it.each(['PLANNED', 'IN_PROGRESS', 'REJECTED'])(
      'submits from %s and clears any old review',
      async (status) => {
        prisma.db.deliverable.findUnique.mockResolvedValue(row({ status }));
        await service.submit('org_1', 'proj_1', 'd1');
        expect(updateData()).toMatchObject({
          status: 'SUBMITTED',
          submittedAt: expect.any(Date),
          reviewedById: null,
          rejectionReason: null,
        });
      },
    );

    it.each(['SUBMITTED', 'ACCEPTED'])(
      'refuses to submit from %s',
      async (status) => {
        prisma.db.deliverable.findUnique.mockResolvedValue(row({ status }));
        await expect(service.submit('org_1', 'proj_1', 'd1')).rejects.toThrow(
          ConflictException,
        );
        expect(prisma.db.deliverable.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('accept / reject', () => {
    it('accepts a submitted deliverable and records who and when', async () => {
      prisma.db.deliverable.findUnique.mockResolvedValue(
        row({ status: 'SUBMITTED' }),
      );
      await service.accept('org_1', 'proj_1', 'd1', 'pm_1');
      expect(updateData()).toMatchObject({
        status: 'ACCEPTED',
        reviewedById: 'pm_1',
        reviewedAt: expect.any(Date),
      });
    });

    it('rejects with the reason stored', async () => {
      prisma.db.deliverable.findUnique.mockResolvedValue(
        row({ status: 'SUBMITTED' }),
      );
      await service.reject('org_1', 'proj_1', 'd1', 'pm_1', 'Thiếu phụ lục');
      expect(updateData()).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Thiếu phụ lục',
      });
    });

    it.each(['PLANNED', 'IN_PROGRESS', 'ACCEPTED', 'REJECTED'])(
      'cannot accept or reject from %s',
      async (status) => {
        prisma.db.deliverable.findUnique.mockResolvedValue(row({ status }));
        await expect(
          service.accept('org_1', 'proj_1', 'd1', 'pm_1'),
        ).rejects.toThrow(ConflictException);
        await expect(
          service.reject('org_1', 'proj_1', 'd1', 'pm_1', 'x'),
        ).rejects.toThrow(ConflictException);
      },
    );
  });

  describe('update', () => {
    it.each(['SUBMITTED', 'ACCEPTED', 'REJECTED'])(
      'editing content of a %s deliverable sends it back to IN_PROGRESS and clears the sign-off',
      async (status) => {
        prisma.db.deliverable.findUnique.mockResolvedValue(row({ status }));
        await service.update('org_1', 'proj_1', 'd1', { name: 'Tên mới' });
        expect(updateData()).toMatchObject({
          status: 'IN_PROGRESS',
          submittedAt: null,
          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,
        });
      },
    );

    it('keeps an accepted deliverable accepted when only non-content fields change', async () => {
      prisma.db.deliverable.findUnique.mockResolvedValue(
        row({ status: 'ACCEPTED' }),
      );
      await service.update('org_1', 'proj_1', 'd1', { ownerId: 'u1' });
      expect(updateData().status).toBeUndefined();
    });

    it('does not count resubmitting an identical value as a content change', async () => {
      prisma.db.deliverable.findUnique.mockResolvedValue(
        row({ status: 'ACCEPTED', name: 'Báo cáo' }),
      );
      await service.update('org_1', 'proj_1', 'd1', { name: 'Báo cáo' });
      expect(updateData().status).toBeUndefined();
    });

    it('lets work-in-progress move between PLANNED and IN_PROGRESS', async () => {
      prisma.db.deliverable.findUnique.mockResolvedValue(
        row({ status: 'PLANNED' }),
      );
      await service.update('org_1', 'proj_1', 'd1', { status: 'IN_PROGRESS' });
      expect(updateData().status).toBe('IN_PROGRESS');
    });
  });

  describe('scoping', () => {
    it('404s for a deliverable in another project or org', async () => {
      prisma.db.deliverable.findUnique.mockResolvedValue(
        row({ projectId: 'other' }),
      );
      await expect(service.submit('org_1', 'proj_1', 'd1')).rejects.toThrow(
        NotFoundException,
      );
      prisma.db.deliverable.findUnique.mockResolvedValue(
        row({ organizationId: 'other' }),
      );
      await expect(service.submit('org_1', 'proj_1', 'd1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects linking a task from another project', async () => {
      prisma.db.task.findUnique.mockResolvedValue({
        id: 't1',
        organizationId: 'org_1',
        projectId: 'other',
      });
      await expect(
        service.create('org_1', 'proj_1', 'u1', { name: 'x', taskId: 't1' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.db.deliverable.create).not.toHaveBeenCalled();
    });
  });
});

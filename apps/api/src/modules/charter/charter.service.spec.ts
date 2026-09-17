import { NotFoundException } from '@nestjs/common';
import { CharterService } from './charter.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeCharter(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    status: 'DRAFT',
    approvedById: null,
    approvedAt: null,
    createdById: 'user_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CharterService', () => {
  let prisma: {
    db: {
      projectCharter: {
        findUnique: ReturnType<typeof vi.fn>;
        upsert: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: CharterService;

  beforeEach(() => {
    prisma = {
      db: {
        projectCharter: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn(),
        },
      },
    };
    service = new CharterService(prisma as unknown as PrismaService);
  });

  describe('getOrNull', () => {
    it('returns null when no charter exists yet', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(null);
      await expect(service.getOrNull('org_1', 'proj_1')).resolves.toBeNull();
    });

    it('returns null (not the row) when the charter belongs to a different organization', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(
        makeCharter({ organizationId: 'org_OTHER' }),
      );
      await expect(service.getOrNull('org_1', 'proj_1')).resolves.toBeNull();
    });

    it('returns the charter when it belongs to the given organization', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(makeCharter());
      await expect(service.getOrNull('org_1', 'proj_1')).resolves.toMatchObject(
        { id: 'c1' },
      );
    });
  });

  describe('upsert', () => {
    it('explicitly sets organizationId in the create branch (extension does not auto-inject it for upsert)', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(null);
      prisma.db.projectCharter.upsert.mockResolvedValue(makeCharter());

      await service.upsert('org_1', 'proj_1', 'user_1', { sponsorName: 'CEO' });

      expect(prisma.db.projectCharter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            organizationId: 'org_1',
            projectId: 'proj_1',
            createdById: 'user_1',
          }),
        }),
      );
    });

    it('reverts status to DRAFT and clears approval when editing an already-approved charter', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(
        makeCharter({
          status: 'APPROVED',
          approvedById: 'user_2',
          approvedAt: new Date(),
        }),
      );
      prisma.db.projectCharter.upsert.mockResolvedValue(makeCharter());

      await service.upsert('org_1', 'proj_1', 'user_1', {
        sponsorName: 'New CEO',
      });

      expect(prisma.db.projectCharter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: 'DRAFT',
            approvedById: null,
            approvedAt: null,
          }),
        }),
      );
    });

    it('does not touch status/approval fields when editing a DRAFT charter', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(
        makeCharter({ status: 'DRAFT' }),
      );
      prisma.db.projectCharter.upsert.mockResolvedValue(makeCharter());

      await service.upsert('org_1', 'proj_1', 'user_1', { sponsorName: 'CEO' });

      const call = prisma.db.projectCharter.upsert.mock.calls[0][0];
      expect(call.update).not.toHaveProperty('status');
    });
  });

  describe('approve', () => {
    it('throws NotFoundException when no charter exists yet', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(null);
      await expect(
        service.approve('org_1', 'proj_1', 'user_1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets status APPROVED with the approving user and a timestamp', async () => {
      prisma.db.projectCharter.findUnique.mockResolvedValue(makeCharter());
      prisma.db.projectCharter.update.mockResolvedValue(
        makeCharter({
          status: 'APPROVED',
          approvedById: 'user_1',
          approvedAt: new Date(),
        }),
      );

      await service.approve('org_1', 'proj_1', 'user_1');

      expect(prisma.db.projectCharter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            approvedById: 'user_1',
          }),
        }),
      );
    });
  });
});

import { NotFoundException } from '@nestjs/common';
import { RisksService } from './risks.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeRisk(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    probability: 3,
    impact: 4,
    severityScore: 12,
    ...overrides,
  };
}

describe('RisksService severity scoring', () => {
  let prisma: {
    db: {
      riskIssue: {
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: RisksService;

  beforeEach(() => {
    prisma = {
      db: {
        riskIssue: {
          create: vi.fn(),
          update: vi.fn(),
          findUnique: vi.fn(),
          delete: vi.fn(),
        },
      },
    };
    service = new RisksService(prisma as unknown as PrismaService);
  });

  it('computes severityScore as probability x impact on create', async () => {
    prisma.db.riskIssue.create.mockResolvedValue(makeRisk());

    await service.create('org_1', 'proj_1', 'user_1', {
      type: 'RISK',
      title: 'Vendor delay',
      probability: 3,
      impact: 4,
    });

    expect(prisma.db.riskIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severityScore: 12 }),
      }),
    );
  });

  it('leaves severityScore null when only one of probability/impact is known', async () => {
    prisma.db.riskIssue.create.mockResolvedValue(
      makeRisk({ severityScore: null }),
    );

    await service.create('org_1', 'proj_1', 'user_1', {
      type: 'ISSUE',
      title: 'Prod outage',
      probability: 5,
    });

    expect(prisma.db.riskIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severityScore: null }),
      }),
    );
  });

  it('recomputes severityScore on update using the existing value for the field left unchanged', async () => {
    prisma.db.riskIssue.findUnique.mockResolvedValue(
      makeRisk({ probability: 3, impact: 4 }),
    );
    prisma.db.riskIssue.update.mockResolvedValue(
      makeRisk({ probability: 5, impact: 4, severityScore: 20 }),
    );

    await service.update('org_1', 'r1', { probability: 5 });

    expect(prisma.db.riskIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ severityScore: 20 }),
      }),
    );
  });

  it('throws NotFoundException when updating a risk from a different organization', async () => {
    prisma.db.riskIssue.findUnique.mockResolvedValue(
      makeRisk({ organizationId: 'org_OTHER' }),
    );

    await expect(
      service.update('org_1', 'r1', { probability: 2 }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.db.riskIssue.update).not.toHaveBeenCalled();
  });
});

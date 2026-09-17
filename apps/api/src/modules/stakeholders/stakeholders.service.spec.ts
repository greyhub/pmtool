import { NotFoundException } from '@nestjs/common';
import { StakeholdersService } from './stakeholders.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeStakeholder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 's1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    fullName: 'Nguyễn Văn A',
    influence: 'MEDIUM',
    interest: 'MEDIUM',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('StakeholdersService', () => {
  let prisma: {
    db: {
      stakeholder: {
        findMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: StakeholdersService;

  beforeEach(() => {
    prisma = {
      db: {
        stakeholder: {
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          findUnique: vi.fn(),
          delete: vi.fn(),
        },
      },
    };
    service = new StakeholdersService(prisma as unknown as PrismaService);
  });

  it('creates a stakeholder scoped to the organization and project', async () => {
    prisma.db.stakeholder.create.mockResolvedValue(makeStakeholder());

    await service.create('org_1', 'proj_1', 'user_1', {
      fullName: 'Nguyễn Văn A',
    });

    expect(prisma.db.stakeholder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_1',
          projectId: 'proj_1',
          fullName: 'Nguyễn Văn A',
          createdById: 'user_1',
        }),
      }),
    );
  });

  it('allows a stakeholder with no linked userId (external stakeholder)', async () => {
    prisma.db.stakeholder.create.mockResolvedValue(makeStakeholder());

    await service.create('org_1', 'proj_1', 'user_1', {
      fullName: 'Khách hàng bên ngoài',
      organizationName: 'Công ty XYZ',
    });

    expect(prisma.db.stakeholder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: undefined,
          organizationName: 'Công ty XYZ',
        }),
      }),
    );
  });

  it('throws NotFoundException when updating a stakeholder from a different organization', async () => {
    prisma.db.stakeholder.findUnique.mockResolvedValue(
      makeStakeholder({ organizationId: 'org_OTHER' }),
    );

    await expect(
      service.update('org_1', 's1', { fullName: 'Sửa tên' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.db.stakeholder.update).not.toHaveBeenCalled();
  });

  it('removes a stakeholder that belongs to the organization', async () => {
    prisma.db.stakeholder.findUnique.mockResolvedValue(makeStakeholder());
    prisma.db.stakeholder.delete.mockResolvedValue(makeStakeholder());

    await service.remove('org_1', 's1');

    expect(prisma.db.stakeholder.delete).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
  });

  it('lists stakeholders ordered by influence then interest', async () => {
    prisma.db.stakeholder.findMany.mockResolvedValue([makeStakeholder()]);

    await service.list('org_1', 'proj_1');

    expect(prisma.db.stakeholder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', projectId: 'proj_1' },
        orderBy: [
          { influence: 'desc' },
          { interest: 'desc' },
          { createdAt: 'asc' },
        ],
      }),
    );
  });
});

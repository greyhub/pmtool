import { NotFoundException } from '@nestjs/common';
import { ArtifactsService } from './artifacts.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeArtifact(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'a1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    title: 'Trang chào mừng',
    htmlContent: '<h1>Xin chào</h1>',
    createdById: 'user_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ArtifactsService', () => {
  let prisma: {
    db: {
      artifact: {
        findMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: ArtifactsService;

  beforeEach(() => {
    prisma = {
      db: {
        artifact: {
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          findUnique: vi.fn(),
          delete: vi.fn(),
        },
      },
    };
    service = new ArtifactsService(prisma as unknown as PrismaService);
  });

  it('lists artifacts using a select that excludes htmlContent', async () => {
    prisma.db.artifact.findMany.mockResolvedValue([]);

    await service.list('org_1', 'proj_1');

    expect(prisma.db.artifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', projectId: 'proj_1' },
        select: expect.not.objectContaining({ htmlContent: true }),
      }),
    );
  });

  it('creates an artifact scoped to the organization and project, defaulting empty content', async () => {
    prisma.db.artifact.create.mockResolvedValue(makeArtifact());

    await service.create('org_1', 'proj_1', 'user_1', {
      title: 'Trang chào mừng',
    });

    expect(prisma.db.artifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_1',
          projectId: 'proj_1',
          title: 'Trang chào mừng',
          htmlContent: '',
          createdById: 'user_1',
        }),
      }),
    );
  });

  it('throws NotFoundException when getting an artifact from a different organization', async () => {
    prisma.db.artifact.findUnique.mockResolvedValue(
      makeArtifact({ organizationId: 'org_OTHER' }),
    );

    await expect(service.getByIdOrThrow('org_1', 'a1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when updating an artifact that does not exist', async () => {
    prisma.db.artifact.findUnique.mockResolvedValue(null);

    await expect(service.update('org_1', 'a1', { title: 'X' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.db.artifact.update).not.toHaveBeenCalled();
  });

  it('removes an artifact that belongs to the organization', async () => {
    prisma.db.artifact.findUnique.mockResolvedValue(makeArtifact());
    prisma.db.artifact.delete.mockResolvedValue(makeArtifact());

    await service.remove('org_1', 'a1');

    expect(prisma.db.artifact.delete).toHaveBeenCalledWith({
      where: { id: 'a1' },
    });
  });
});

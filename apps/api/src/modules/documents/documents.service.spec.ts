import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeDocument(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'd1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    title: 'Kế hoạch dự án',
    category: 'PLAN',
    version: '1.0',
    status: 'DRAFT',
    url: 'https://example.com/plan.pdf',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DocumentsService', () => {
  let prisma: {
    db: {
      projectDocument: {
        findMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: DocumentsService;

  beforeEach(() => {
    prisma = {
      db: {
        projectDocument: {
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          findUnique: vi.fn(),
          delete: vi.fn(),
        },
      },
    };
    service = new DocumentsService(prisma as unknown as PrismaService);
  });

  it('creates a document scoped to the organization and project', async () => {
    prisma.db.projectDocument.create.mockResolvedValue(makeDocument());

    await service.create('org_1', 'proj_1', 'user_1', {
      title: 'Kế hoạch dự án',
      url: 'https://example.com/plan.pdf',
    });

    expect(prisma.db.projectDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_1',
          projectId: 'proj_1',
          title: 'Kế hoạch dự án',
          url: 'https://example.com/plan.pdf',
          createdById: 'user_1',
        }),
      }),
    );
  });

  it('throws NotFoundException when updating a document from a different organization', async () => {
    prisma.db.projectDocument.findUnique.mockResolvedValue(
      makeDocument({ organizationId: 'org_OTHER' }),
    );

    await expect(
      service.update('org_1', 'd1', { title: 'Sửa tiêu đề' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.db.projectDocument.update).not.toHaveBeenCalled();
  });

  it('removes a document that belongs to the organization', async () => {
    prisma.db.projectDocument.findUnique.mockResolvedValue(makeDocument());
    prisma.db.projectDocument.delete.mockResolvedValue(makeDocument());

    await service.remove('org_1', 'd1');

    expect(prisma.db.projectDocument.delete).toHaveBeenCalledWith({
      where: { id: 'd1' },
    });
  });

  it('lists documents newest first', async () => {
    prisma.db.projectDocument.findMany.mockResolvedValue([makeDocument()]);

    await service.list('org_1', 'proj_1');

    expect(prisma.db.projectDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', projectId: 'proj_1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});

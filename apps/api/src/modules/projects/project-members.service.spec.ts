import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectMember } from '@prisma/client';
import { ProjectMembersService } from './project-members.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeProjectMember(
  overrides: Partial<ProjectMember> = {},
): ProjectMember {
  return {
    id: 'pm_1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    userId: 'user_1',
    role: 'MEMBER',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ProjectMembersService', () => {
  let prisma: {
    db: {
      membership: { findUnique: ReturnType<typeof vi.fn> };
      projectMember: {
        findUnique: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: ProjectMembersService;

  beforeEach(() => {
    prisma = {
      db: {
        membership: { findUnique: vi.fn() },
        projectMember: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    };
    service = new ProjectMembersService(prisma as unknown as PrismaService);
  });

  describe('add', () => {
    it('throws when the target user is not an org member', async () => {
      prisma.db.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.add('org_1', 'proj_1', { userId: 'user_1', role: 'PM' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.db.projectMember.create).not.toHaveBeenCalled();
    });

    it('throws a conflict when an override already exists for this user/project', async () => {
      prisma.db.membership.findUnique.mockResolvedValue({ id: 'mem_1' });
      prisma.db.projectMember.findUnique.mockResolvedValue(makeProjectMember());

      await expect(
        service.add('org_1', 'proj_1', { userId: 'user_1', role: 'PM' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.db.projectMember.create).not.toHaveBeenCalled();
    });

    it('creates an override when the target is an org member with no existing override', async () => {
      prisma.db.membership.findUnique.mockResolvedValue({ id: 'mem_1' });
      prisma.db.projectMember.findUnique.mockResolvedValue(null);
      prisma.db.projectMember.create.mockResolvedValue(
        makeProjectMember({ role: 'PM' }),
      );

      const result = await service.add('org_1', 'proj_1', {
        userId: 'user_1',
        role: 'PM',
      });

      expect(result.role).toBe('PM');
      expect(prisma.db.projectMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            organizationId: 'org_1',
            projectId: 'proj_1',
            userId: 'user_1',
            role: 'PM',
          },
        }),
      );
    });
  });

  describe('updateRole / remove', () => {
    it('throws NotFoundException when the override belongs to a different project', async () => {
      prisma.db.projectMember.findUnique.mockResolvedValue(
        makeProjectMember({ projectId: 'proj_other' }),
      );

      await expect(
        service.updateRole('org_1', 'proj_1', 'pm_1', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
      await expect(service.remove('org_1', 'proj_1', 'pm_1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates the role of an existing override', async () => {
      prisma.db.projectMember.findUnique.mockResolvedValue(makeProjectMember());
      prisma.db.projectMember.update.mockResolvedValue(
        makeProjectMember({ role: 'ADMIN' }),
      );

      const result = await service.updateRole(
        'org_1',
        'proj_1',
        'pm_1',
        'ADMIN',
      );

      expect(result.role).toBe('ADMIN');
    });

    it('removes an existing override', async () => {
      prisma.db.projectMember.findUnique.mockResolvedValue(makeProjectMember());

      await service.remove('org_1', 'proj_1', 'pm_1');

      expect(prisma.db.projectMember.delete).toHaveBeenCalledWith({
        where: { id: 'pm_1' },
      });
    });
  });
});

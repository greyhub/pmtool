import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Membership } from '@prisma/client';
import { MembershipsService } from './memberships.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'mem_1',
    organizationId: 'org_1',
    userId: 'user_1',
    role: 'MEMBER',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MembershipsService', () => {
  let prisma: {
    db: {
      membership: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: MembershipsService;

  beforeEach(() => {
    prisma = {
      db: {
        membership: {
          findUnique: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          count: vi.fn(),
        },
      },
    };
    service = new MembershipsService(prisma as unknown as PrismaService);
  });

  describe('updateRole', () => {
    it('throws when demoting the last OWNER of an organization', async () => {
      const owner = makeMembership({ role: 'OWNER' });
      prisma.db.membership.findUnique.mockResolvedValue(owner);
      prisma.db.membership.count.mockResolvedValue(0);

      await expect(
        service.updateRole('org_1', owner.id, 'MEMBER'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.db.membership.update).not.toHaveBeenCalled();
    });

    it('allows demoting an OWNER when another OWNER remains', async () => {
      const owner = makeMembership({ role: 'OWNER' });
      prisma.db.membership.findUnique.mockResolvedValue(owner);
      prisma.db.membership.count.mockResolvedValue(1);
      prisma.db.membership.update.mockResolvedValue({
        ...owner,
        role: 'ADMIN',
      });

      const result = await service.updateRole('org_1', owner.id, 'ADMIN');

      expect(result.role).toBe('ADMIN');
      expect(prisma.db.membership.update).toHaveBeenCalledWith({
        where: { id: owner.id },
        data: { role: 'ADMIN' },
      });
    });

    it('throws NotFoundException when the membership belongs to a different organization', async () => {
      const membership = makeMembership({ organizationId: 'org_other' });
      prisma.db.membership.findUnique.mockResolvedValue(membership);

      await expect(
        service.updateRole('org_1', membership.id, 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('throws when removing the last OWNER of an organization', async () => {
      const owner = makeMembership({ role: 'OWNER' });
      prisma.db.membership.findUnique.mockResolvedValue(owner);
      prisma.db.membership.count.mockResolvedValue(0);

      await expect(service.removeMember('org_1', owner.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.db.membership.delete).not.toHaveBeenCalled();
    });

    it('allows removing a non-OWNER member', async () => {
      const member = makeMembership({ role: 'MEMBER' });
      prisma.db.membership.findUnique.mockResolvedValue(member);
      prisma.db.membership.delete.mockResolvedValue(member);

      await service.removeMember('org_1', member.id);

      expect(prisma.db.membership.delete).toHaveBeenCalledWith({
        where: { id: member.id },
      });
    });
  });
});

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Membership, MembershipInvite } from '@prisma/client';
import { MembershipsService } from './memberships.service';
import { PrismaService } from '../../prisma/prisma.service';

function makeInvite(
  overrides: Partial<MembershipInvite> = {},
): MembershipInvite {
  return {
    id: 'inv_1',
    organizationId: 'org_1',
    email: 'invitee@example.com',
    role: 'MEMBER',
    tokenHash: 'hash',
    invitedById: 'user_owner',
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

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
        findFirst: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
      };
      membershipInvite: {
        findUnique: ReturnType<typeof vi.fn>;
        deleteMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
      };
      projectMember: {
        deleteMany: ReturnType<typeof vi.fn>;
      };
      $transaction: ReturnType<typeof vi.fn>;
    };
  };
  let service: MembershipsService;

  beforeEach(() => {
    prisma = {
      db: {
        membership: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          count: vi.fn(),
        },
        membershipInvite: {
          findUnique: vi.fn(),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn(),
          delete: vi.fn(),
        },
        projectMember: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma.db)),
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

    it('also clears any per-project role overrides for the removed user', async () => {
      const member = makeMembership({ role: 'MEMBER' });
      prisma.db.membership.findUnique.mockResolvedValue(member);
      prisma.db.membership.delete.mockResolvedValue(member);

      await service.removeMember('org_1', member.id);

      expect(prisma.db.projectMember.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'org_1', userId: member.userId },
      });
    });
  });

  describe('createInvite', () => {
    it('rejects inviting an email that already belongs to a member', async () => {
      prisma.db.membership.findFirst.mockResolvedValue(makeMembership());

      await expect(
        service.createInvite('org_1', 'user_owner', {
          email: 'existing@example.com',
          role: 'MEMBER',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.db.membershipInvite.create).not.toHaveBeenCalled();
    });

    it('replaces any existing pending invite for the same email instead of stacking duplicates', async () => {
      prisma.db.membership.findFirst.mockResolvedValue(null);
      prisma.db.membershipInvite.create.mockResolvedValue(makeInvite());

      await service.createInvite('org_1', 'user_owner', {
        email: 'invitee@example.com',
        role: 'MEMBER',
      });

      expect(prisma.db.membershipInvite.deleteMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org_1',
          email: 'invitee@example.com',
          acceptedAt: null,
        },
      });
      expect(prisma.db.membershipInvite.create).toHaveBeenCalled();
    });

    it('lowercases the invited email for consistent lookups', async () => {
      prisma.db.membership.findFirst.mockResolvedValue(null);
      prisma.db.membershipInvite.create.mockResolvedValue(makeInvite());

      await service.createInvite('org_1', 'user_owner', {
        email: 'Invitee@Example.com',
        role: 'MEMBER',
      });

      expect(prisma.db.membership.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org_1',
          user: { email: 'invitee@example.com' },
        },
      });
    });
  });

  describe('cancelInvite', () => {
    it('throws NotFoundException when the invite belongs to a different organization', async () => {
      prisma.db.membershipInvite.findUnique.mockResolvedValue(
        makeInvite({ organizationId: 'org_other' }),
      );

      await expect(service.cancelInvite('org_1', 'inv_1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.db.membershipInvite.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the invite was already accepted', async () => {
      prisma.db.membershipInvite.findUnique.mockResolvedValue(
        makeInvite({ acceptedAt: new Date() }),
      );

      await expect(service.cancelInvite('org_1', 'inv_1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.db.membershipInvite.delete).not.toHaveBeenCalled();
    });

    it('deletes a pending invite', async () => {
      prisma.db.membershipInvite.findUnique.mockResolvedValue(makeInvite());

      await service.cancelInvite('org_1', 'inv_1');

      expect(prisma.db.membershipInvite.delete).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
      });
    });
  });
});

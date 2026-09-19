import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService.updatePreferences', () => {
  let prisma: {
    db: {
      user: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      membership: {
        findMany: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      db: {
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'user_1', mascotCharacter: 'fox' }),
          update: vi
            .fn()
            .mockResolvedValue({ id: 'user_1', mascotCharacter: 'otter' }),
        },
        membership: {
          findMany: vi.fn().mockResolvedValue([{ organizationId: 'org_1' }]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('allows a character no other org member has', async () => {
    await service.updatePreferences('user_1', { mascotCharacter: 'otter' });
    expect(prisma.db.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: { in: ['org_1'] },
          userId: { not: 'user_1' },
          user: { mascotCharacter: 'otter' },
        }),
      }),
    );
    expect(prisma.db.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { mascotCharacter: 'otter' },
    });
  });

  it("rejects a character another member of one of the user's orgs already has", async () => {
    prisma.db.membership.findFirst.mockResolvedValue({
      organization: { name: 'Công ty Demo' },
    });

    await expect(
      service.updatePreferences('user_1', { mascotCharacter: 'panda' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.db.user.update).not.toHaveBeenCalled();
  });

  it('allows resubmitting the character the user already has, without a conflict check', async () => {
    await service.updatePreferences('user_1', { mascotCharacter: 'fox' });
    expect(prisma.db.membership.findFirst).not.toHaveBeenCalled();
    expect(prisma.db.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { mascotCharacter: 'fox' },
    });
  });

  it('skips the conflict check entirely for a user with no organizations', async () => {
    prisma.db.membership.findMany.mockResolvedValue([]);
    await service.updatePreferences('user_1', { mascotCharacter: 'panda' });
    expect(prisma.db.membership.findFirst).not.toHaveBeenCalled();
    expect(prisma.db.user.update).toHaveBeenCalled();
  });

  it('does not run the conflict check when mascotCharacter is not part of the update', async () => {
    await service.updatePreferences('user_1', { themePref: 'dark' });
    expect(prisma.db.membership.findMany).not.toHaveBeenCalled();
    expect(prisma.db.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { themePref: 'dark' },
    });
  });
});

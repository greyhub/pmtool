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

describe('UsersService.takenCharacters', () => {
  it('lists each character other members use once, with who has it', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ organizationId: 'org_1' }])
      .mockResolvedValueOnce([
        { user: { fullName: 'An', mascotCharacter: 'cat' } },
        { user: { fullName: 'Bình', mascotCharacter: 'cat' } },
        { user: { fullName: 'Chi', mascotCharacter: 'bear' } },
      ]);
    const service = new UsersService({
      db: { membership: { findMany } },
    } as unknown as PrismaService);

    expect(await service.takenCharacters('me')).toEqual([
      { character: 'cat', takenBy: 'An' },
      { character: 'bear', takenBy: 'Chi' },
    ]);
  });

  it('is empty for a user with no organization', async () => {
    const service = new UsersService({
      db: { membership: { findMany: vi.fn().mockResolvedValue([]) } },
    } as unknown as PrismaService);
    expect(await service.takenCharacters('me')).toEqual([]);
  });
});

describe('UsersService.resolveCharacterConflictOnJoin', () => {
  let prisma: {
    db: {
      user: {
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      membership: {
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      db: {
        user: {
          findUnique: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
        membership: {
          findMany: vi.fn(),
        },
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('leaves the character alone when nobody else in the same orgs has it', async () => {
    prisma.db.user.findUnique.mockResolvedValue({ mascotCharacter: 'otter' });
    prisma.db.membership.findMany
      .mockResolvedValueOnce([{ organizationId: 'org_1' }])
      .mockResolvedValueOnce([{ user: { mascotCharacter: 'fox' } }]);

    await service.resolveCharacterConflictOnJoin('user_1');

    expect(prisma.db.user.update).not.toHaveBeenCalled();
  });

  it('reassigns to a free character when the new org already has this one', async () => {
    prisma.db.user.findUnique.mockResolvedValue({ mascotCharacter: 'fox' });
    prisma.db.membership.findMany
      .mockResolvedValueOnce([{ organizationId: 'org_1' }])
      .mockResolvedValueOnce([
        { user: { mascotCharacter: 'fox' } },
        { user: { mascotCharacter: 'bear' } },
      ]);

    await service.resolveCharacterConflictOnJoin('user_1');

    const call = prisma.db.user.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'user_1' });
    // Never the taken ones, and never left on the conflicting "fox".
    expect(['fox', 'bear']).not.toContain(call.data.mascotCharacter);
  });

  it('picks randomly among the free characters rather than always the first one', async () => {
    prisma.db.user.findUnique.mockResolvedValue({ mascotCharacter: 'fox' });
    prisma.db.membership.findMany
      .mockResolvedValueOnce([{ organizationId: 'org_1' }])
      .mockResolvedValueOnce([{ user: { mascotCharacter: 'fox' } }]);
    // Force Math.random to point at the last free character instead of the first.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999999);

    await service.resolveCharacterConflictOnJoin('user_1');

    const picked = prisma.db.user.update.mock.calls[0][0].data.mascotCharacter;
    expect(picked).not.toBe('bear'); // "bear" is MASCOT_CHARACTERS[0] — a fixed-first pick would land here
    randomSpy.mockRestore();
  });

  it('does nothing for someone who belongs to no organization yet', async () => {
    prisma.db.user.findUnique.mockResolvedValue({ mascotCharacter: 'fox' });
    prisma.db.membership.findMany.mockResolvedValueOnce([]);

    await service.resolveCharacterConflictOnJoin('user_1');

    expect(prisma.db.membership.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.db.user.update).not.toHaveBeenCalled();
  });

  it('does nothing when the account no longer exists', async () => {
    prisma.db.user.findUnique.mockResolvedValue(null);

    await service.resolveCharacterConflictOnJoin('user_1');

    expect(prisma.db.membership.findMany).not.toHaveBeenCalled();
    expect(prisma.db.user.update).not.toHaveBeenCalled();
  });
});

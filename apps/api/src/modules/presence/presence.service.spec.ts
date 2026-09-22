import { PresenceService } from './presence.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    db: {
      user: { update: vi.fn().mockResolvedValue({}) },
      loginEvent: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
      membership: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
}

describe('PresenceService.touch', () => {
  it('writes the heartbeat on the first call', () => {
    const prisma = makePrisma();
    const service = new PresenceService(prisma as unknown as PrismaService);
    service.touch('user_1');
    expect(prisma.db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_1' } }),
    );
  });

  it('throttles a second call for the same user within the window', () => {
    const prisma = makePrisma();
    const service = new PresenceService(prisma as unknown as PrismaService);
    service.touch('user_1');
    service.touch('user_1');
    expect(prisma.db.user.update).toHaveBeenCalledTimes(1);
  });

  it('does not throttle across different users', () => {
    const prisma = makePrisma();
    const service = new PresenceService(prisma as unknown as PrismaService);
    service.touch('user_1');
    service.touch('user_2');
    expect(prisma.db.user.update).toHaveBeenCalledTimes(2);
  });

  it('never throws even if the write fails', () => {
    const prisma = makePrisma();
    prisma.db.user.update = vi.fn().mockRejectedValue(new Error('db down'));
    const service = new PresenceService(prisma as unknown as PrismaService);
    expect(() => service.touch('user_1')).not.toThrow();
  });
});

describe('PresenceService.isOnline', () => {
  const service = new PresenceService({} as unknown as PrismaService);

  it('is online just inside the window', () => {
    expect(service.isOnline(new Date(Date.now() - 60_000))).toBe(true);
  });

  it('is offline once past the window', () => {
    expect(service.isOnline(new Date(Date.now() - 10 * 60_000))).toBe(false);
  });

  it('is offline when never active', () => {
    expect(service.isOnline(null)).toBe(false);
  });
});

describe('PresenceService login history', () => {
  it('records a login event with the given method, ip and user agent', async () => {
    const prisma = makePrisma();
    const service = new PresenceService(prisma as unknown as PrismaService);
    await service.recordLogin('user_1', 'GOOGLE', '1.2.3.4', 'Mozilla/5.0');
    expect(prisma.db.loginEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        method: 'GOOGLE',
        ip: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      },
    });
  });

  it('org login history returns nothing without querying login events when the org has no members', async () => {
    const prisma = makePrisma();
    const service = new PresenceService(prisma as unknown as PrismaService);
    const events = await service.orgLoginHistory('org_1');
    expect(events).toEqual([]);
    expect(prisma.db.loginEvent.findMany).not.toHaveBeenCalled();
  });

  it('org login history queries only the current members', async () => {
    const prisma = makePrisma();
    prisma.db.membership.findMany.mockResolvedValue([
      { userId: 'a' },
      { userId: 'b' },
    ]);
    const service = new PresenceService(prisma as unknown as PrismaService);
    await service.orgLoginHistory('org_1');
    expect(prisma.db.loginEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: ['a', 'b'] } } }),
    );
  });
});

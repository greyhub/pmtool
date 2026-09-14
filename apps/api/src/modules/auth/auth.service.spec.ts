import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { hashRefreshToken } from './refresh-token.util';

function makeConfigService(): ConfigService {
  const values: Record<string, unknown> = {
    JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL_DAYS: 30,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('AuthService.refresh', () => {
  let prisma: {
    db: {
      refreshToken: {
        findUnique: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
      user: {
        findUnique: ReturnType<typeof vi.fn>;
        findUniqueOrThrow: ReturnType<typeof vi.fn>;
      };
    };
  };
  let jwtService: JwtService;
  let service: AuthService;

  const rawToken = 'a-raw-refresh-token';
  const user = { id: 'user_1', email: 'u@example.com' };

  beforeEach(() => {
    prisma = {
      db: {
        refreshToken: {
          findUnique: vi.fn(),
          updateMany: vi.fn(),
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: 'rt_new' }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(user),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...user,
            fullName: 'Test User',
            avatarUrl: null,
            locale: 'vi',
            themePref: 'system',
            createdAt: new Date(),
          }),
        },
      },
    };
    jwtService = new JwtService({});
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      makeConfigService() as never,
    );
  });

  it('rejects an unknown refresh token', async () => {
    prisma.db.refreshToken.findUnique.mockResolvedValue(null);

    await expect(service.refresh(rawToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('revokes every active session when a revoked (already-rotated) token is reused', async () => {
    prisma.db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      userId: user.id,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() + 100_000),
      revokedAt: new Date(),
    });

    await expect(service.refresh(rawToken)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(prisma.db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects an expired refresh token', async () => {
    prisma.db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      userId: user.id,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    });

    await expect(service.refresh(rawToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rotates a valid token: issues a new session and revokes the old one', async () => {
    prisma.db.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      userId: user.id,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() + 100_000),
      revokedAt: null,
    });

    const result = await service.refresh(rawToken);

    expect(result.tokens.user.id).toBe(user.id);
    expect(prisma.db.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt_1' },
      data: { revokedAt: expect.any(Date), replacedByTokenId: 'rt_new' },
    });
  });
});

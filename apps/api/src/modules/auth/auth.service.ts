import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthTokens, LoginInput, RegisterInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { EnvConfig } from '../../config/env.schema';
import { AccessTokenPayload } from './token.types';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';
import { toUserDto } from './user.mapper';

export interface IssuedRefreshToken {
  rawToken: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly gamificationService: GamificationService,
  ) {}

  async register(
    input: RegisterInput,
    userAgent?: string,
  ): Promise<{ tokens: AuthTokens; refreshToken: IssuedRefreshToken }> {
    const existing = await this.prisma.db.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.db.user.create({
      data: { email: input.email, passwordHash, fullName: input.fullName },
    });

    return this.issueSession(user.id, user.email, userAgent);
  }

  async login(
    input: LoginInput,
    userAgent?: string,
  ): Promise<{ tokens: AuthTokens; refreshToken: IssuedRefreshToken }> {
    const user = await this.prisma.db.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      input.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await this.gamificationService.recordLogin(user.id);

    return this.issueSession(user.id, user.email, userAgent);
  }

  async refresh(
    rawRefreshToken: string,
    userAgent?: string,
  ): Promise<{ tokens: AuthTokens; refreshToken: IssuedRefreshToken }> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const existing = await this.prisma.db.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated/revoked token: treat as a compromise
      // signal and kill every session for this user.
      await this.prisma.db.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại',
      );
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    const user = await this.prisma.db.user.findUnique({
      where: { id: existing.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const session = await this.issueSession(user.id, user.email, userAgent);

    await this.prisma.db.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: session.refreshTokenId,
      },
    });

    return session;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await this.prisma.db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async issueSession(
    userId: string,
    email: string,
    userAgent?: string,
  ): Promise<{
    tokens: AuthTokens;
    refreshToken: IssuedRefreshToken;
    refreshTokenId: string;
  }> {
    const payload: AccessTokenPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_ACCESS_TTL', { infer: true }),
    });
    const decoded = this.jwtService.decode(accessToken) as { exp: number };

    const rawRefreshToken = generateRefreshToken();
    const refreshTtlDays = this.configService.get('JWT_REFRESH_TTL_DAYS', {
      infer: true,
    });
    const expiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    const stored = await this.prisma.db.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(rawRefreshToken),
        expiresAt,
        userAgent,
      },
    });

    const user = await this.prisma.db.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      tokens: {
        accessToken,
        accessTokenExpiresAt: new Date(decoded.exp * 1000).toISOString(),
        user: toUserDto(user),
      },
      refreshToken: { rawToken: rawRefreshToken, expiresAt },
      refreshTokenId: stored.id,
    };
  }
}

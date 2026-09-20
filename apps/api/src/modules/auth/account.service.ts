import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthTokenType } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { passwordResetMail, verifyEmailMail } from '../mail/mail-templates';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';

const RESET_TTL_MIN = 60;
const VERIFY_TTL_HOURS = 24;
const INVALID_LINK = 'Liên kết không hợp lệ hoặc đã hết hạn';

/** Emailed one-time links: forgotten passwords and email verification. */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Issues a fresh token, voiding any earlier unused one of the same kind. */
  private async issue(
    userId: string,
    type: AuthTokenType,
    ttlMs: number,
  ): Promise<string> {
    const raw = generateRefreshToken();
    await this.prisma.db.$transaction([
      this.prisma.db.authToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.db.authToken.create({
        data: {
          userId,
          type,
          tokenHash: hashRefreshToken(raw),
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);
    return raw;
  }

  /** Marks the token used (exactly once, even under concurrent requests) and returns its user. */
  private async consume(raw: string, type: AuthTokenType): Promise<string> {
    const tokenHash = hashRefreshToken(raw);
    const claimed = await this.prisma.db.authToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException(INVALID_LINK);
    const token = await this.prisma.db.authToken.findUniqueOrThrow({
      where: { tokenHash },
    });
    return token.userId;
  }

  /** Always resolves the same way, so the endpoint cannot be used to discover which emails have accounts. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return;
    const raw = await this.issue(
      user.id,
      'PASSWORD_RESET',
      RESET_TTL_MIN * 60_000,
    );
    const locale = user.locale === 'en' ? 'en' : 'vi';
    const url = this.mail.webUrl(`/${locale}/reset-password?token=${raw}`);
    await this.mail.send(
      user.email,
      passwordResetMail(locale, url, RESET_TTL_MIN),
    );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const userId = await this.consume(rawToken, 'PASSWORD_RESET');
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.db.$transaction([
      // Following the emailed link also proves the user owns the address.
      this.prisma.db.user.update({
        where: { id: userId },
        data: { passwordHash, hasPassword: true, emailVerifiedAt: new Date() },
      }),
      // Whoever knew the old password (or stole a session) is signed out everywhere.
      this.prisma.db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async sendVerification(
    userId: string,
  ): Promise<{ alreadyVerified: boolean }> {
    const user = await this.prisma.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.emailVerifiedAt) return { alreadyVerified: true };
    const raw = await this.issue(
      user.id,
      'EMAIL_VERIFY',
      VERIFY_TTL_HOURS * 3_600_000,
    );
    const locale = user.locale === 'en' ? 'en' : 'vi';
    const url = this.mail.webUrl(`/${locale}/verify-email?token=${raw}`);
    await this.mail.send(
      user.email,
      verifyEmailMail(locale, url, user.fullName),
    );
    return { alreadyVerified: false };
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const userId = await this.consume(rawToken, 'EMAIL_VERIFY');
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }
}

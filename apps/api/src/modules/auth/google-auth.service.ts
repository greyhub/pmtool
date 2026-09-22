import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { PresenceService } from '../presence/presence.service';
import { AuthService } from './auth.service';
import { GoogleProfile } from './google-client';

/** Turns a verified Google identity into a PMTool session, creating the account the first time. */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly gamification: GamificationService,
    private readonly presence: PresenceService,
  ) {}

  async signIn(profile: GoogleProfile, userAgent?: string, ip?: string) {
    if (!profile.emailVerified) throw new Error('Google email is not verified');
    if (profile.email.endsWith('@deleted.invalid'))
      throw new Error('Reserved address');

    const existing = await this.prisma.db.user.findUnique({
      where: { email: profile.email },
    });
    let userId: string;
    let email: string;
    if (existing) {
      userId = existing.id;
      email = existing.email;
      // Google vouches for the address, so an unverified password account becomes verified.
      if (!existing.emailVerifiedAt) {
        await this.prisma.db.user.update({
          where: { id: userId },
          data: { emailVerifiedAt: new Date() },
        });
      }
    } else {
      const created = await this.prisma.db.user.create({
        data: {
          email: profile.email,
          fullName: (
            profile.name ??
            profile.email.split('@')[0] ??
            profile.email
          ).slice(0, 120),
          avatarUrl: profile.picture,
          // A random password nobody knows: the account can only be entered through Google (or a reset link).
          passwordHash: await argon2.hash(randomBytes(32).toString('hex')),
          hasPassword: false,
          emailVerifiedAt: new Date(),
        },
      });
      userId = created.id;
      email = created.email;
      this.logger.log(`Created account from Google sign-in: ${userId}`);
    }
    await this.gamification.recordLogin(userId);
    await this.presence.recordLogin(userId, 'GOOGLE', ip, userAgent);
    return this.auth.issueSession(userId, email, userAgent);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { LoginMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isOnline } from './online.util';

/** How often a single user's heartbeat is actually written — every request touching it would hammer the DB for no benefit. */
const TOUCH_THROTTLE_MS = 30 * 1000;
const LOGIN_HISTORY_LIMIT = 20;
const ORG_LOGIN_HISTORY_LIMIT = 100;

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  /** Per-process only — good enough for the single-instance deployment this app runs today (same tradeoff as the in-memory rate limiter). */
  private readonly lastWrite = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget: called from the JWT strategy on every authenticated request, must never slow or fail one. */
  touch(userId: string): void {
    const now = Date.now();
    const last = this.lastWrite.get(userId) ?? 0;
    if (now - last < TOUCH_THROTTLE_MS) return;
    this.lastWrite.set(userId, now);
    this.prisma.db.user
      .update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } })
      .catch((err: unknown) =>
        this.logger.warn(`presence touch failed for ${userId}: ${String(err)}`),
      );
  }

  isOnline(lastActiveAt: Date | null): boolean {
    return isOnline(lastActiveAt);
  }

  /** One row per real sign-in — never called from the silent token-refresh path (see LoginEvent's doc comment). */
  async recordLogin(
    userId: string,
    method: LoginMethod,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.db.loginEvent.create({
      data: { userId, method, ip, userAgent },
    });
  }

  async myLoginHistory(userId: string, limit = LOGIN_HISTORY_LIMIT) {
    return this.prisma.db.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Every login by every current member of the org — for the OWNER/ADMIN audit view. */
  async orgLoginHistory(
    organizationId: string,
    limit = ORG_LOGIN_HISTORY_LIMIT,
  ) {
    const memberships = await this.prisma.db.membership.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = memberships.map((m) => m.userId);
    if (userIds.length === 0) return [];
    return this.prisma.db.loginEvent.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }
}

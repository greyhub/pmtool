import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { vnDateKey } from '../gamification/streak-date.util';

/**
 * Caps AI calls per organization per Vietnam day. The free tier has no revenue
 * to absorb model costs, so the cap is enforced before the provider is called.
 */
@Injectable()
export class AiQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  get dailyLimit(): number {
    // Number(): ConfigService returns the raw process.env string when the variable is set.
    return Number(this.config.get('AI_DAILY_LIMIT_PER_ORG', { infer: true }));
  }

  /** Counts one call; throws 429 when the organization is over today's cap. */
  async consume(
    organizationId: string,
    now: Date = new Date(),
  ): Promise<{ used: number; limit: number }> {
    const limit = this.dailyLimit;
    const day = vnDateKey(now);
    // The tenant extension does not inject organizationId into an upsert's create branch.
    const row = await this.prisma.db.aiUsageDaily.upsert({
      where: { organizationId_day: { organizationId, day } },
      create: { organizationId, day, count: 1 },
      update: { count: { increment: 1 } },
    });
    if (row.count > limit) {
      throw new HttpException(
        `Tổ chức đã dùng hết ${limit} lượt AI của hôm nay. Hạn mức được làm mới vào 00:00 giờ Việt Nam.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { used: row.count, limit };
  }
}

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { EnvConfig } from '../../config/env.schema';
import { RATE_LIMIT_KEY, RateLimitRule } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly limiter: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[] | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rules || rules.length === 0) return true;
    // ConfigService hands back the raw process.env string when the variable is set.
    if (
      String(this.config.get('RATE_LIMIT_ENABLED', { infer: true })) === 'false'
    )
      return true;

    const req = context.switchToHttp().getRequest();
    for (const rule of rules) {
      const who = this.identify(req, rule.by);
      const { allowed, retryAfterSec } = this.limiter.hit(
        `${rule.name}:${who}`,
        rule.limit,
        rule.windowSec * 1000,
      );
      if (!allowed) {
        const res = context.switchToHttp().getResponse();
        res.setHeader?.('Retry-After', String(retryAfterSec));
        throw new HttpException(
          `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfterSec} giây.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }

  private identify(
    req: { ip?: string; user?: { id?: string }; body?: { email?: unknown } },
    by: RateLimitRule['by'],
  ) {
    const ip = req.ip ?? 'unknown';
    if (by === 'user') return req.user?.id ?? ip;
    if (by === 'ipEmail') {
      const email =
        typeof req.body?.email === 'string'
          ? req.body.email.trim().toLowerCase()
          : '';
      return `${ip}|${email}`;
    }
    return ip;
  }
}

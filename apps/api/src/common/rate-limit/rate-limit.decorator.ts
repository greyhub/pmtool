import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitRule {
  /** Names the bucket, so one route's traffic never eats another's allowance. */
  name: string;
  limit: number;
  windowSec: number;
  /** What identifies the caller: the client IP, the signed-in user, or IP + the `email` in the body. */
  by: 'ip' | 'user' | 'ipEmail';
}

/** Applies one or more fixed-window limits to a route (enforced by RateLimitGuard). */
export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata<string, RateLimitRule[]>(RATE_LIMIT_KEY, rules);

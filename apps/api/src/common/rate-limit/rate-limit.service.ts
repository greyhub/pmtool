import { Injectable } from '@nestjs/common';
import { RateLimiter } from './rate-limiter';

@Injectable()
export class RateLimitService {
  private readonly limiter = new RateLimiter();

  hit(key: string, limit: number, windowMs: number) {
    return this.limiter.hit(key, limit, windowMs);
  }
}

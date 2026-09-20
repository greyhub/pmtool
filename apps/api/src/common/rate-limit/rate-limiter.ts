/**
 * Fixed-window counter keyed by an arbitrary string. Held in process memory,
 * which is right for a single API instance (the dev/beta deployment); running
 * several instances would need the same interface backed by Redis.
 */
export class RateLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private lastSweep = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Counts one hit. `allowed` is false once `limit` is exceeded within the window. */
  hit(
    key: string,
    limit: number,
    windowMs: number,
  ): { allowed: boolean; retryAfterSec: number } {
    const t = this.now();
    this.sweep(t);
    let w = this.windows.get(key);
    if (!w || w.resetAt <= t) {
      w = { count: 0, resetAt: t + windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return {
      allowed: w.count <= limit,
      retryAfterSec: Math.max(1, Math.ceil((w.resetAt - t) / 1000)),
    };
  }

  /** Drops expired windows now and then so the map cannot grow without bound. */
  private sweep(t: number) {
    if (t - this.lastSweep < 60_000) return;
    this.lastSweep = t;
    for (const [k, w] of Array.from(this.windows)) {
      if (w.resetAt <= t) this.windows.delete(k);
    }
  }
}

import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows up to the limit, then blocks until the window resets', () => {
    let now = 1_000_000;
    const limiter = new RateLimiter(() => now);
    for (let i = 0; i < 3; i++)
      expect(limiter.hit('a', 3, 60_000).allowed).toBe(true);
    const blocked = limiter.hit('a', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);

    now += 30_000;
    expect(limiter.hit('a', 3, 60_000).retryAfterSec).toBe(30);

    now += 30_001;
    expect(limiter.hit('a', 3, 60_000).allowed).toBe(true);
  });

  it('keeps separate keys separate', () => {
    const limiter = new RateLimiter(() => 0);
    limiter.hit('a', 1, 1000);
    expect(limiter.hit('a', 1, 1000).allowed).toBe(false);
    expect(limiter.hit('b', 1, 1000).allowed).toBe(true);
  });
});

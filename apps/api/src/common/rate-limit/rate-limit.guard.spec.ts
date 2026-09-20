import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { RateLimitRule } from './rate-limit.decorator';

function ctx(req: object) {
  const res = { setHeader: vi.fn() };
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

function guard(rules: RateLimitRule[] | undefined, enabled = true) {
  const reflector = { getAllAndOverride: () => rules } as unknown as Reflector;
  const config = { get: () => enabled } as never;
  return new RateLimitGuard(reflector, config, new RateLimitService());
}

describe('RateLimitGuard', () => {
  const rule: RateLimitRule = {
    name: 'login',
    limit: 2,
    windowSec: 60,
    by: 'ipEmail',
  };

  it('answers 429 once a caller passes the limit', () => {
    const g = guard([rule]);
    const req = { ip: '1.1.1.1', body: { email: 'A@x.com' } };
    expect(g.canActivate(ctx(req))).toBe(true);
    expect(g.canActivate(ctx(req))).toBe(true);
    try {
      g.canActivate(ctx(req));
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(429);
    }
  });

  it('counts the same email in different case as one caller, and different emails separately', () => {
    const g = guard([{ ...rule, limit: 1 }]);
    expect(
      g.canActivate(ctx({ ip: '1.1.1.1', body: { email: 'a@x.com' } })),
    ).toBe(true);
    expect(() =>
      g.canActivate(ctx({ ip: '1.1.1.1', body: { email: 'A@X.COM' } })),
    ).toThrow(HttpException);
    expect(
      g.canActivate(ctx({ ip: '1.1.1.1', body: { email: 'b@x.com' } })),
    ).toBe(true);
  });

  it('does nothing for undecorated routes or when disabled', () => {
    expect(guard(undefined).canActivate(ctx({ ip: '1.1.1.1' }))).toBe(true);
    const off = guard([{ ...rule, limit: 0 }], false);
    expect(off.canActivate(ctx({ ip: '1.1.1.1' }))).toBe(true);
  });
});

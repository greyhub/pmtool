import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { EmailVerifiedGuard } from './email-verified.guard';

const ctx = (user?: { id: string }) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

function make(required: string, verifiedAt: Date | null) {
  const findUnique = vi.fn().mockResolvedValue({ emailVerifiedAt: verifiedAt });
  const guard = new EmailVerifiedGuard(
    { db: { user: { findUnique } } } as never,
    { get: () => required } as never,
  );
  return { guard, findUnique };
}

describe('EmailVerifiedGuard', () => {
  it('lets everyone through while verification is not required (and skips the lookup)', async () => {
    const { guard, findUnique } = make('false', null);
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('blocks an unverified account once verification is required', async () => {
    const { guard } = make('true', null);
    await expect(guard.canActivate(ctx({ id: 'u1' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets a verified account through', async () => {
    const { guard } = make('true', new Date());
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });
});

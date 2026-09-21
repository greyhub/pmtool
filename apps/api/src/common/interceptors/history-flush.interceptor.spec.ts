import { describe, expect, it, vi } from 'vitest';
import { CallHandler } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  HistoryDraft,
  requestContextStorage,
} from '../context/request-context';
import { HistoryFlushInterceptor } from './history-flush.interceptor';

const draft = (over: Partial<HistoryDraft> = {}): HistoryDraft => ({
  organizationId: 'org',
  projectId: 'p',
  entityType: 'RiskIssue',
  entityId: 'r1',
  subjectType: null,
  subjectId: null,
  action: 'UPDATE',
  label: 'A risk',
  changes: [{ field: 'status', from: 'A', to: 'B' }],
  snapshot: null,
  ...over,
});

function setup() {
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const prisma = { audit: { entityHistory: { createMany } } };
  const interceptor = new HistoryFlushInterceptor(prisma as never);
  return { createMany, interceptor };
}

const run = <T>(store: object, fn: () => Promise<T>) =>
  requestContextStorage.run(store as never, fn);

describe('HistoryFlushInterceptor', () => {
  it('writes the collected entries once the handler has succeeded, attributed to the caller', async () => {
    const { createMany, interceptor } = setup();
    const store = {
      userId: 'u1',
      history: [
        draft(),
        draft({
          entityId: 'r2',
          action: 'CREATE',
          changes: null,
          snapshot: { title: 'x' },
        }),
      ],
    };
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    const result = await run(store, () =>
      lastValueFrom(interceptor.intercept({} as never, handler)),
    );
    expect(result).toEqual({ ok: true });
    expect(createMany).toHaveBeenCalledTimes(1);
    const data = createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      organizationId: 'org',
      entityType: 'RiskIssue',
      entityId: 'r1',
      actorId: 'u1',
      action: 'UPDATE',
    });
    expect(store.history).toEqual([]); // not written twice
  });

  it('records nothing for a request that failed', async () => {
    const { createMany, interceptor } = setup();
    const store = { userId: 'u1', history: [draft()] };
    const handler: CallHandler = {
      handle: () =>
        throwError(() => new Error('validation failed after a write')),
    };
    await expect(
      run(store, () =>
        lastValueFrom(interceptor.intercept({} as never, handler)),
      ),
    ).rejects.toThrow('validation failed');
    expect(createMany).not.toHaveBeenCalled();
  });

  it('drops the entries of an organization the request deleted (its history goes with it) without complaining', async () => {
    const { createMany, interceptor } = setup();
    const store = {
      userId: 'u1',
      history: [
        draft({
          organizationId: 'gone',
          entityType: 'Organization',
          entityId: 'gone',
          action: 'DELETE',
          changes: null,
        }),
        draft({ organizationId: 'gone', entityId: 'r1', action: 'DELETE' }),
        draft({ organizationId: 'kept', entityId: 'r9' }),
      ],
    };
    await run(store, () =>
      lastValueFrom(
        interceptor.intercept({} as never, { handle: () => of('x') }),
      ),
    );
    const data = createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ organizationId: 'kept', entityId: 'r9' });
  });

  it('does nothing for a request that changed nothing', async () => {
    const { createMany, interceptor } = setup();
    const handler: CallHandler = { handle: () => of('x') };
    await run({ userId: 'u1' }, () =>
      lastValueFrom(interceptor.intercept({} as never, handler)),
    );
    await run({ userId: 'u1', history: [] }, () =>
      lastValueFrom(interceptor.intercept({} as never, handler)),
    );
    expect(createMany).not.toHaveBeenCalled();
  });

  it('never fails the response because the trail could not be written', async () => {
    const { createMany, interceptor } = setup();
    createMany.mockRejectedValueOnce(new Error('db down'));
    const handler: CallHandler = { handle: () => of({ saved: true }) };
    const result = await run({ userId: 'u1', history: [draft()] }, () =>
      lastValueFrom(interceptor.intercept({} as never, handler)),
    );
    expect(result).toEqual({ saved: true });
  });
});

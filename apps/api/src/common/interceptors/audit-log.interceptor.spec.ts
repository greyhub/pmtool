import { firstValueFrom, of } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import * as requestContext from '../context/request-context';
import { ActivityService } from '../../modules/activity/activity.service';

function makeContext(params: Record<string, string> = {}) {
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ params }) }),
  } as any;
}

describe('AuditLogInterceptor', () => {
  let reflector: { get: ReturnType<typeof vi.fn> };
  let activityService: { record: ReturnType<typeof vi.fn> };
  let interceptor: AuditLogInterceptor;

  beforeEach(() => {
    reflector = { get: vi.fn() };
    activityService = { record: vi.fn().mockResolvedValue(undefined) };
    interceptor = new AuditLogInterceptor(
      reflector as any,
      activityService as unknown as ActivityService,
    );
    vi.spyOn(requestContext, 'getRequestContext').mockReturnValue({
      userId: 'user_1',
      organizationId: 'org_1',
    });
  });

  it('passes through untouched when the handler has no @LogActivity metadata', async () => {
    reflector.get.mockReturnValue(undefined);
    const next = { handle: () => of({ data: { id: 't1' } }) };

    await firstValueFrom(interceptor.intercept(makeContext(), next));
    expect(activityService.record).not.toHaveBeenCalled();
  });

  it('records activity using the entity id and title from the response body', async () => {
    reflector.get.mockReturnValue({ entityType: 'Task', action: 'created' });
    const next = {
      handle: () => of({ data: { id: 't1', title: 'Viết tài liệu' } }),
    };

    await firstValueFrom(interceptor.intercept(makeContext(), next));
    expect(activityService.record).toHaveBeenCalledWith({
      organizationId: 'org_1',
      actorId: 'user_1',
      entityType: 'Task',
      action: 'created',
      entityId: 't1',
      metadata: { title: 'Viết tài liệu' },
    });
  });

  it('falls back to the route param for the entity id when the response has no body (delete)', async () => {
    reflector.get.mockReturnValue({
      entityType: 'Task',
      action: 'deleted',
      idParam: 'taskId',
    });
    const next = { handle: () => of(undefined) };

    await firstValueFrom(
      interceptor.intercept(makeContext({ taskId: 't9' }), next),
    );
    expect(activityService.record).toHaveBeenCalledWith({
      organizationId: 'org_1',
      actorId: 'user_1',
      entityType: 'Task',
      action: 'deleted',
      entityId: 't9',
      metadata: undefined,
    });
  });

  it('does not record when no organization is resolved in the request context', async () => {
    reflector.get.mockReturnValue({ entityType: 'Task', action: 'created' });
    vi.spyOn(requestContext, 'getRequestContext').mockReturnValue({
      userId: 'user_1',
    } as any);
    const next = { handle: () => of({ data: { id: 't1' } }) };

    await firstValueFrom(interceptor.intercept(makeContext(), next));
    expect(activityService.record).not.toHaveBeenCalled();
  });
});

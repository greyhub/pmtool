import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import {
  LOG_ACTIVITY_KEY,
  LogActivityMeta,
} from '../decorators/log-activity.decorator';
import { getRequestContext } from '../context/request-context';
import { ActivityService } from '../../modules/activity/activity.service';

/**
 * Records an ActivityLog row after a @LogActivity-decorated mutation succeeds.
 * Runs globally (registered as APP_INTERCEPTOR) but no-ops for any handler
 * without the decorator. Logging failures are swallowed — the mutation
 * itself already committed and must not be reported as failed to the client.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityService: ActivityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<LogActivityMeta | undefined>(
      LOG_ACTIVITY_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((response: { data?: Record<string, unknown> } | undefined) => {
        const ctx = getRequestContext();
        if (!ctx?.organizationId) return;

        const data = response?.data;
        const entityId =
          (data?.id as string | undefined) ??
          (meta.idParam ? request.params?.[meta.idParam] : undefined);
        if (!entityId) return;

        const title =
          typeof data?.title === 'string'
            ? data.title
            : typeof data?.name === 'string'
              ? data.name
              : undefined;

        this.activityService
          .record({
            organizationId: ctx.organizationId,
            actorId: ctx.userId,
            entityType: meta.entityType,
            action: meta.action,
            entityId: String(entityId),
            metadata: title ? { title } : undefined,
          })
          .catch(() => {});
      }),
    );
  }
}

import { SetMetadata } from '@nestjs/common';

export const LOG_ACTIVITY_KEY = 'log_activity';

export interface LogActivityMeta {
  entityType: string;
  action: string;
  /** Route param to fall back on for the entity id when the response has no body (e.g. a DELETE). */
  idParam?: string;
}

/** Marks a mutation handler for AuditLogInterceptor to record into ActivityLog after a successful response. */
export const LogActivity = (
  entityType: string,
  action: string,
  idParam?: string,
) =>
  SetMetadata<string, LogActivityMeta>(LOG_ACTIVITY_KEY, {
    entityType,
    action,
    idParam,
  });

import { AsyncLocalStorage } from 'node:async_hooks';
import { OrgRole } from '@prisma/client';

export interface RequestContextStore {
  userId: string;
  organizationId?: string;
  orgRole?: OrgRole;
  /** Extra detail a handler wants recorded on this request's activity-log row (e.g. what changed). */
  activityMetadata?: Record<string, unknown>;
}

export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}

export function getOrganizationIdOrThrow(): string {
  const orgId = requestContextStorage.getStore()?.organizationId;
  if (!orgId) {
    throw new Error(
      'No organizationId in request context — this query requires an org-scoped request',
    );
  }
  return orgId;
}

/** Lets a service enrich the ActivityLog row the AuditLogInterceptor writes for this request. */
export function addActivityMetadata(extra: Record<string, unknown>): void {
  const store = requestContextStorage.getStore();
  if (store) store.activityMetadata = { ...store.activityMetadata, ...extra };
}

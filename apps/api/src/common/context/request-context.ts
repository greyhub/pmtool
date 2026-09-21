import { AsyncLocalStorage } from 'node:async_hooks';
import { OrgRole } from '@prisma/client';

/** A change waiting to be written to entity_history once the request has succeeded. */
export interface HistoryDraft {
  organizationId: string;
  projectId: string | null;
  entityType: string;
  entityId: string;
  subjectType: string | null;
  subjectId: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  label: string | null;
  changes:
    { field: string; from?: unknown; to?: unknown; changed?: true }[] | null;
  snapshot: Record<string, unknown> | null;
}

export interface RequestContextStore {
  userId: string;
  organizationId?: string;
  orgRole?: OrgRole;
  /** Extra detail a handler wants recorded on this request's activity-log row (e.g. what changed). */
  activityMetadata?: Record<string, unknown>;
  /** Changes to business entities made during this request, written after it succeeds. */
  history?: HistoryDraft[];
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

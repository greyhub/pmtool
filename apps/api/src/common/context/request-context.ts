import { AsyncLocalStorage } from 'node:async_hooks';
import { OrgRole } from '@prisma/client';

export interface RequestContextStore {
  userId: string;
  organizationId?: string;
  orgRole?: OrgRole;
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

import { Prisma } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';

/**
 * Models that carry an `organizationId` column and must never be read or
 * written without that scope. Extend this set as new tenant-owned models
 * are added (RiskIssue, ActivityLog, ...).
 */
const TENANT_SCOPED_MODELS = new Set([
  'Membership',
  'MembershipInvite',
  'Project',
  'ProjectMember',
  'Task',
  'TaskAssignee',
  'TaskDependency',
  'BoardColumn',
  'Comment',
  'RiskIssue',
  'ActivityLog',
]);

const FILTERABLE_READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);
const WRITE_MANY_OPS = new Set(['updateMany', 'deleteMany']);

export function tenantScopingExtension() {
  return Prisma.defineExtension({
    name: 'tenant-scoping',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const ctx = getRequestContext();
          const organizationId = ctx?.organizationId;
          if (!organizationId) {
            // No org resolved yet in this request (e.g. the membership lookup a
            // guard performs while establishing that very context, or a
            // system/seed script) — the caller is responsible for explicit
            // scoping in that case, so pass the query through unmodified.
            return query(args);
          }

          const a = args as Record<string, unknown>;

          if (
            operation === 'findUnique' ||
            operation === 'findUniqueOrThrow' ||
            operation === 'update' ||
            operation === 'delete' ||
            operation === 'upsert' ||
            FILTERABLE_READ_OPS.has(operation) ||
            WRITE_MANY_OPS.has(operation)
          ) {
            a.where = { ...(a.where as object | undefined), organizationId };
          }

          if (operation === 'create' && a.data) {
            a.data = { ...(a.data as object), organizationId };
          }

          if (operation === 'createMany' && a.data) {
            a.data = Array.isArray(a.data)
              ? a.data.map((d: object) => ({ ...d, organizationId }))
              : a.data;
          }

          return query(a as typeof args);
        },
      },
    },
  });
}

import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  getRequestContext,
  HistoryDraft,
} from '../../common/context/request-context';
import {
  AUDITED,
  diffRows,
  FieldChange,
  keyOf,
  snapshotOf,
  touchesRecordedFields,
} from './history-diff';

const logger = new Logger('EntityHistory');

const HANDLED = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);
/** A bulk write records at most this many rows; the operation itself is never limited. */
const BULK_LIMIT = 500;
/** One request never buffers more than this many entries (a runaway import must not exhaust memory). */
const BUFFER_LIMIT = 2000;

type Row = Record<string, unknown>;
type Delegate = {
  findUnique(args: unknown): Promise<Row | null>;
  findMany(args: unknown): Promise<Row[]>;
};

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

interface Described {
  organizationId: string | null;
  projectId: string | null;
  label: string | null;
  subject: { type: string; id: string } | null;
}

/** Who a row belongs to and how to name it — looked up for the few models that only know their task. */
async function describe(
  base: PrismaClient,
  model: string,
  row: Row,
  cache: Map<string, Row | null>,
): Promise<Described> {
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const task = async (id: unknown): Promise<Row | null> => {
    const key = `task:${String(id)}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        await base.task.findUnique({
          where: { id: String(id) },
          select: { id: true, humanKey: true, title: true, projectId: true },
        }),
      );
    }
    return cache.get(key) ?? null;
  };
  const orgId =
    str(row.organizationId) ?? (model === 'Organization' ? str(row.id) : null);
  switch (model) {
    case 'Organization':
      return {
        organizationId: orgId,
        projectId: null,
        label: str(row.name),
        subject: null,
      };
    case 'Membership':
      return {
        organizationId: orgId,
        projectId: null,
        label: str(row.userId),
        subject: null,
      };
    case 'Project':
      return {
        organizationId: orgId,
        projectId: str(row.id),
        label: `${str(row.key) ?? ''} ${str(row.name) ?? ''}`.trim(),
        subject: null,
      };
    case 'ProjectMember':
      return {
        organizationId: orgId,
        projectId: str(row.projectId),
        label: str(row.userId),
        subject: null,
      };
    case 'Task':
      return {
        organizationId: orgId,
        projectId: str(row.projectId),
        label: `${str(row.humanKey) ?? ''} ${str(row.title) ?? ''}`.trim(),
        subject: null,
      };
    case 'TaskAssignee': {
      const t = await task(row.taskId);
      return {
        organizationId: orgId,
        projectId: str(t?.projectId),
        label: str(row.userId),
        subject: { type: 'Task', id: String(row.taskId) },
      };
    }
    case 'TaskDependency': {
      const [p, s] = await Promise.all([
        task(row.predecessorId),
        task(row.successorId),
      ]);
      return {
        organizationId: orgId,
        projectId: str(s?.projectId) ?? str(p?.projectId),
        label: `${str(p?.humanKey) ?? '?'} → ${str(s?.humanKey) ?? '?'}`,
        subject: { type: 'Task', id: String(row.successorId) },
      };
    }
    case 'WbsDictionaryEntry': {
      const t = await task(row.taskId);
      return {
        organizationId: orgId,
        projectId: str(t?.projectId),
        label: t
          ? `${str(t.humanKey) ?? ''} ${str(t.title) ?? ''}`.trim()
          : null,
        subject: { type: 'Task', id: String(row.taskId) },
      };
    }
    case 'Stakeholder':
      return {
        organizationId: orgId,
        projectId: str(row.projectId),
        label: str(row.fullName),
        subject: null,
      };
    case 'Deliverable':
    case 'BoardColumn':
    case 'Sprint':
      return {
        organizationId: orgId,
        projectId: str(row.projectId),
        label: str(row.name),
        subject: null,
      };
    case 'ProjectCharter':
    case 'ProjectScope':
      return {
        organizationId: orgId,
        projectId: str(row.projectId),
        label: null,
        subject: null,
      };
    default:
      // RiskIssue, ProjectDocument, Artifact: a title.
      return {
        organizationId: orgId,
        projectId: str(row.projectId),
        label: str(row.title),
        subject: null,
      };
  }
}

/**
 * Keeps a full change history of the business entities. Every create / update / delete is turned into a draft entry
 * (which fields changed, before → after; for a delete, what the row held) and parked on the request. The entries are
 * written only after the request has succeeded (see HistoryFlushInterceptor), so a request that fails and rolls back leaves
 * no trace of changes that never happened. Work outside a request (scheduled jobs) is not recorded.
 */
export function historyExtension(base: PrismaClient) {
  // `base` is the history client on its own connection pool (see PrismaService): reading with it never waits for a connection
  // that a transaction of the same request is holding.
  const delegate = (model: string) =>
    (base as unknown as Record<string, Delegate>)[lower(model)]!;

  return Prisma.defineExtension({
    name: 'entity-history',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = getRequestContext();
          if (!AUDITED[model] || !ctx || !HANDLED.has(operation))
            return query(args);
          const a = args as { where?: unknown; data?: unknown };
          // A write that only moves bookkeeping columns (a sequence counter, a drag-and-drop order) records nothing, so it
          // needs no read either.
          if (
            (operation === 'update' || operation === 'updateMany') &&
            !touchesRecordedFields(model, a.data)
          )
            return query(args);

          // What the rows looked like before the write.
          let before: Row[] = [];
          try {
            if (
              operation === 'update' ||
              operation === 'delete' ||
              operation === 'upsert'
            ) {
              const row = await delegate(model).findUnique({ where: a.where });
              before = row ? [row] : [];
            } else if (
              operation === 'updateMany' ||
              operation === 'deleteMany'
            ) {
              before = await delegate(model).findMany({
                where: a.where,
                take: BULK_LIMIT,
              });
            }
          } catch (err) {
            logger.error(
              `Could not read ${model} before ${operation}: ${(err as Error).message}`,
            );
          }

          const result = await query(args);

          try {
            const drafts: HistoryDraft[] = [];
            const cache = new Map<string, Row | null>();
            const push = async (
              action: HistoryDraft['action'],
              row: Row,
              changes: FieldChange[] | null,
              snapshot: Row | null,
            ) => {
              const d = await describe(base, model, row, cache);
              const organizationId = d.organizationId ?? ctx.organizationId;
              if (!organizationId) return;
              drafts.push({
                organizationId,
                projectId: d.projectId,
                entityType: AUDITED[model]!.type,
                entityId: keyOf(model, row),
                subjectType: d.subject?.type ?? null,
                subjectId: d.subject?.id ?? null,
                action,
                label: d.label,
                changes: changes && changes.length > 0 ? changes : null,
                snapshot,
              });
            };

            if (operation === 'create') {
              const row = result as Row;
              await push('CREATE', row, null, snapshotOf(model, row));
            } else if (operation === 'createMany' && model === 'TaskAssignee') {
              const rows = (Array.isArray(a.data) ? a.data : [a.data]) as Row[];
              for (const row of rows.slice(0, BULK_LIMIT))
                await push('CREATE', row, null, snapshotOf(model, row));
            } else if (operation === 'update') {
              const row = result as Row;
              const prev = before[0];
              if (prev) {
                const changes = diffRows(model, prev, row);
                if (changes.length > 0)
                  await push('UPDATE', row, changes, null);
              }
            } else if (operation === 'upsert') {
              const row = result as Row;
              const prev = before[0];
              if (!prev)
                await push('CREATE', row, null, snapshotOf(model, row));
              else {
                const changes = diffRows(model, prev, row);
                if (changes.length > 0)
                  await push('UPDATE', row, changes, null);
              }
            } else if (operation === 'delete' || operation === 'deleteMany') {
              for (const row of before)
                await push('DELETE', row, null, snapshotOf(model, row));
            } else if (
              operation === 'updateMany' &&
              model !== 'TaskAssignee' &&
              before.length > 0
            ) {
              const ids = before.map((r) => r.id);
              const after = await delegate(model).findMany({
                where: { id: { in: ids } },
              });
              const byId = new Map(after.map((r) => [String(r.id), r]));
              for (const prev of before) {
                const next = byId.get(String(prev.id));
                if (!next) continue;
                const changes = diffRows(model, prev, next);
                if (changes.length > 0)
                  await push('UPDATE', next, changes, null);
              }
            }

            if (drafts.length > 0) {
              const buffer = (ctx.history ??= []);
              for (const d of drafts)
                if (buffer.length < BUFFER_LIMIT) buffer.push(d);
            }
          } catch (err) {
            // The change itself succeeded; say loudly that its history entry could not be prepared.
            logger.error(
              `Could not record history for ${model}.${operation}: ${(err as Error).message}`,
            );
          }
          return result;
        },
      },
    },
  });
}

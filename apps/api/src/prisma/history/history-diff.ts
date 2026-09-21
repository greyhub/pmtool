import { Prisma } from '@prisma/client';

export type HistoryAction = 'CREATE' | 'UPDATE' | 'DELETE';

/** One field that changed. `changed` alone means "it changed but the value is too long/private to keep". */
export interface FieldChange {
  field: string;
  from?: unknown;
  to?: unknown;
  changed?: true;
}

export interface AuditModel {
  /** Name shown to people and stored as `entityType`. */
  type: string;
  /** Columns that are noise (ordering, bookkeeping) or derived — never recorded. */
  ignore?: string[];
  /** Columns whose value is too large or private to store: only the fact that they changed is kept. */
  bulky?: string[];
}

/** Columns nobody needs in a change trail. */
const ALWAYS_IGNORED = new Set([
  'id',
  'organizationId',
  'createdAt',
  'updatedAt',
  'createdById',
  'assignedAt',
]);

/**
 * The models whose every create / update / delete is kept. To give a new entity a history, add it here — nothing else
 * in the code needs to know. (User accounts, tokens, notifications and generated snapshots are deliberately absent.)
 */
export const AUDITED: Record<string, AuditModel> = {
  Organization: { type: 'Organization' },
  Membership: { type: 'Membership' },
  Project: { type: 'Project', ignore: ['taskSequence'] },
  ProjectMember: { type: 'ProjectMember' },
  Task: {
    type: 'Task',
    ignore: [
      'orderIndex',
      'telegramReminderSentAt',
      'completedAt',
      'sprintAddedAt',
    ],
    bulky: ['description'],
  },
  TaskAssignee: { type: 'TaskAssignee' },
  TaskDependency: { type: 'TaskDependency' },
  BoardColumn: { type: 'BoardColumn', ignore: ['orderIndex'] },
  RiskIssue: { type: 'RiskIssue' },
  Deliverable: { type: 'Deliverable' },
  Stakeholder: { type: 'Stakeholder' },
  ProjectDocument: { type: 'ProjectDocument' },
  ProjectCharter: {
    type: 'ProjectCharter',
    bulky: [
      'purpose',
      'objectives',
      'scopeSummary',
      'assumptions',
      'constraints',
    ],
  },
  ProjectScope: {
    type: 'ProjectScope',
    bulky: [
      'inScope',
      'outOfScope',
      'deliverablesSummary',
      'acceptanceCriteria',
      'assumptions',
      'constraints',
    ],
  },
  WbsDictionaryEntry: {
    type: 'WbsDictionaryEntry',
    bulky: [
      'scopeDescription',
      'acceptanceCriteria',
      'assumptions',
      'constraints',
    ],
  },
  Sprint: { type: 'Sprint', ignore: ['outcome'], bulky: ['reviewNotes'] },
  Artifact: { type: 'Artifact', bulky: ['htmlContent'] },
};

const MAX_TEXT = 300;

/** A value as it is stored in the trail: JSON-safe, dates as ISO strings, long text cut. */
export function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string')
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
  }
  return String(value);
}

/** Equality on the stored form, so two dates or two equal JSON blobs compare as the same. */
function sameValue(a: unknown, b: unknown): boolean {
  const key = (v: unknown) =>
    v instanceof Date
      ? v.toISOString()
      : typeof v === 'object' && v !== null
        ? JSON.stringify(v)
        : (v ?? null);
  return key(a) === key(b);
}

/** The real columns of each model. A query result may also carry included relations or counts; those are not part of the row. */
const COLUMNS = new Map<string, Set<string>>(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    new Set(
      m.fields
        .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
        .map((f) => f.name),
    ),
  ]),
);

function recordedFields(model: string, row: Record<string, unknown>): string[] {
  const cfg = AUDITED[model];
  const ignore = new Set(cfg?.ignore ?? []);
  const columns = COLUMNS.get(model);
  return Object.keys(row).filter(
    (f) =>
      (!columns || columns.has(f)) && !ALWAYS_IGNORED.has(f) && !ignore.has(f),
  );
}

/** The row as kept for a create or a delete; bulky fields are left out. */
export function snapshotOf(
  model: string,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const bulky = new Set(AUDITED[model]?.bulky ?? []);
  const out: Record<string, unknown> = {};
  for (const f of recordedFields(model, row)) {
    if (bulky.has(f)) {
      if (row[f] !== null && row[f] !== undefined) out[f] = '…';
      continue;
    }
    if (row[f] !== null && row[f] !== undefined) out[f] = normalize(row[f]);
  }
  return out;
}

/**
 * What an update changed. Only real differences count, and only for columns present in both rows (a query that selected
 * fewer columns cannot claim the others changed).
 */
export function diffRows(
  model: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const bulky = new Set(AUDITED[model]?.bulky ?? []);
  const changes: FieldChange[] = [];
  for (const f of recordedFields(model, after)) {
    if (!(f in before)) continue;
    if (sameValue(before[f], after[f])) continue;
    changes.push(
      bulky.has(f)
        ? { field: f, changed: true }
        : { field: f, from: normalize(before[f]), to: normalize(after[f]) },
    );
  }
  return changes;
}

/** The identity of a row: its id, or for the id-less assignment table, task + user. */
export function keyOf(model: string, row: Record<string, unknown>): string {
  if (model === 'TaskAssignee')
    return `${String(row.taskId)}:${String(row.userId)}`;
  return String(row.id);
}

/** Whether an update's `data` changes any column that is recorded (a counter or an ordering column alone is not). */
export function touchesRecordedFields(model: string, data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return true;
  return recordedFields(model, data as Record<string, unknown>).length > 0;
}

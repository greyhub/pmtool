import type { HistoryChangeDto } from '@pmtool/shared-types';

/** Columns that hold a person; shown by name. Every other `…Id` column is an internal link and is not shown as a raw id. */
export const PERSON_FIELDS = new Set([
  'ownerId',
  'userId',
  'reviewedById',
  'approvedById',
  'projectManagerId',
  'updatedById',
  'assigneeId',
]);

const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/;
const ENUM = /^[A-Z][A-Z0-9_]*$/;

export type Formatted =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'date'; date: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'enum'; token: string }
  | { kind: 'person'; id: string }
  | { kind: 'opaque' };

/** What a stored value is, so the screen can word it in the reader's language (dates, Yes/No, status names, people's names). */
export function classifyValue(field: string, value: unknown): Formatted {
  if (value === null || value === undefined || value === '') return { kind: 'empty' };
  if (PERSON_FIELDS.has(field) && typeof value === 'string') return { kind: 'person', id: value };
  if (field.endsWith('Id')) return { kind: 'opaque' };
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'number') return { kind: 'text', text: String(value) };
  if (typeof value === 'string') {
    if (ISO.test(value)) return { kind: 'date', date: value };
    if (ENUM.test(value)) return { kind: 'enum', token: value };
    return { kind: 'text', text: value };
  }
  return { kind: 'text', text: JSON.stringify(value) };
}

/** A change that says nothing to a reader (an internal link that moved) is folded into "changed". */
export function isOpaqueChange(c: HistoryChangeDto): boolean {
  return (
    classifyValue(c.field, c.from).kind === 'opaque' ||
    classifyValue(c.field, c.to).kind === 'opaque'
  );
}

/** The few snapshot fields worth showing for a created or deleted item, in order, skipping empties. */
const SNAPSHOT_FIRST = [
  'title',
  'name',
  'fullName',
  'status',
  'type',
  'priority',
  'role',
  'dueDate',
  'startDate',
  'category',
  'url',
];

export function snapshotHighlights(
  snapshot: Record<string, unknown> | null,
  limit = 6,
): [string, unknown][] {
  if (!snapshot) return [];
  const keys = Object.keys(snapshot);
  const ordered = [
    ...SNAPSHOT_FIRST.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !SNAPSHOT_FIRST.includes(k)),
  ];
  return ordered
    .filter(
      (k) =>
        classifyValue(k, snapshot[k]).kind !== 'empty' &&
        classifyValue(k, snapshot[k]).kind !== 'opaque',
    )
    .slice(0, limit)
    .map((k) => [k, snapshot[k]]);
}

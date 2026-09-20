export type ChangeValue = string | number | boolean | null;

/** One field-level change on a task, stored in ActivityLog.metadata.changes. */
export interface TaskChange {
  field: string;
  from?: ChangeValue;
  to?: ChangeValue;
  /** For list-valued fields (supporters): names added / removed. */
  added?: string[];
  removed?: string[];
}

export interface TaskSnapshot {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  percentComplete: number;
  isMilestone: boolean;
  /** Full name of the primary assignee, if any. */
  assignee: string | null;
  supporters: string[];
}

const SCALARS = [
  'title',
  'status',
  'priority',
  'percentComplete',
  'isMilestone',
] as const;
const DATES = ['startDate', 'dueDate'] as const;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * What a PATCH actually changed. Only real differences are reported — a
 * request that resends today's values yields nothing, so the history isn't
 * padded with no-ops. Descriptions can be long, so only the fact of the
 * edit is kept, not the text.
 */
export function diffTask(
  before: TaskSnapshot,
  after: TaskSnapshot,
): TaskChange[] {
  const changes: TaskChange[] = [];
  for (const f of SCALARS) {
    if (before[f] !== after[f])
      changes.push({ field: f, from: before[f], to: after[f] });
  }
  for (const f of DATES) {
    if (iso(before[f]) !== iso(after[f]))
      changes.push({ field: f, from: iso(before[f]), to: iso(after[f]) });
  }
  if ((before.description ?? '') !== (after.description ?? ''))
    changes.push({ field: 'description' });
  if (before.assignee !== after.assignee)
    changes.push({
      field: 'assignee',
      from: before.assignee,
      to: after.assignee,
    });
  const added = after.supporters.filter((n) => !before.supporters.includes(n));
  const removed = before.supporters.filter(
    (n) => !after.supporters.includes(n),
  );
  if (added.length || removed.length)
    changes.push({ field: 'supporters', added, removed });
  return changes;
}

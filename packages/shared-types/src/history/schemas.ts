import { z } from 'zod';

export const HISTORY_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
export type HistoryActionDto = (typeof HISTORY_ACTIONS)[number];

/** The entities whose changes are kept (see AUDITED in the API). */
export const HISTORY_ENTITY_TYPES = [
  'Organization',
  'Membership',
  'Project',
  'ProjectMember',
  'Task',
  'TaskAssignee',
  'TaskDependency',
  'BoardColumn',
  'RiskIssue',
  'Deliverable',
  'Stakeholder',
  'ProjectDocument',
  'ProjectCharter',
  'ProjectScope',
  'WbsDictionaryEntry',
  'Sprint',
  'Artifact',
] as const;
export type HistoryEntityType = (typeof HISTORY_ENTITY_TYPES)[number];

export const historyChangeSchema = z.object({
  field: z.string(),
  from: z.unknown().optional(),
  to: z.unknown().optional(),
  /** The field changed but its text is not kept (long or private). */
  changed: z.literal(true).optional(),
});
export type HistoryChangeDto = z.infer<typeof historyChangeSchema>;

export const historyEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  action: z.enum(HISTORY_ACTIONS),
  entityType: z.string(),
  entityId: z.string(),
  /** The entity's name when it changed; a deleted item is still recognisable by it. */
  label: z.string().nullable(),
  /** When the change belongs under another entity too (an assignee change under its task). */
  subject: z.object({ type: z.string(), id: z.string() }).nullable(),
  projectKey: z.string().nullable(),
  /** null once that person's account is deleted (or for system work). */
  actor: z.object({ id: z.string(), fullName: z.string(), mascotCharacter: z.string() }).nullable(),
  changes: z.array(historyChangeSchema).nullable(),
  snapshot: z.record(z.string(), z.unknown()).nullable(),
});
export type HistoryEntryDto = z.infer<typeof historyEntrySchema>;

export const historyPageSchema = z.object({
  items: z.array(historyEntrySchema),
  nextCursor: z.string().nullable(),
});
export type HistoryPageDto = z.infer<typeof historyPageSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const historyQuerySchema = z.object({
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(120).optional(),
  action: z.enum(HISTORY_ACTIONS).optional(),
  actorId: z.string().max(60).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

/** The organization-wide audit trail can also be narrowed to one project. */
export const auditQuerySchema = historyQuerySchema.extend({ projectKey: z.string().max(20).optional() });
export type AuditQuery = z.infer<typeof auditQuerySchema>;

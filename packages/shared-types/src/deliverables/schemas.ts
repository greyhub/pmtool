import { z } from 'zod';
import { DELIVERABLE_STATUSES, TASK_STATUSES } from '../common/enums';

export const createDeliverableSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(10_000).optional(),
  acceptanceCriteria: z.string().max(10_000).optional(),
  /** The task (or milestone) that produces this deliverable. */
  taskId: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  url: z.string().url().optional(),
});
export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;

export const updateDeliverableSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().max(10_000).nullable().optional(),
  acceptanceCriteria: z.string().max(10_000).nullable().optional(),
  taskId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  url: z.string().url().nullable().optional(),
  /** Only PLANNED <-> IN_PROGRESS is settable here; submit/accept/reject have their own endpoints. */
  status: z.enum(['PLANNED', 'IN_PROGRESS']).optional(),
});
export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;

export const rejectDeliverableSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
});
export type RejectDeliverableInput = z.infer<typeof rejectDeliverableSchema>;

const personSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const deliverableSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  taskId: z.string().nullable(),
  task: z
    .object({ id: z.string(), humanKey: z.string(), title: z.string(), isMilestone: z.boolean() })
    .nullable(),
  name: z.string(),
  description: z.string().nullable(),
  acceptanceCriteria: z.string().nullable(),
  status: z.enum(DELIVERABLE_STATUSES),
  ownerId: z.string().nullable(),
  owner: personSchema.nullable(),
  dueDate: z.string().nullable(),
  url: z.string().nullable(),
  submittedAt: z.string().nullable(),
  reviewedBy: personSchema.nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DeliverableDto = z.infer<typeof deliverableSchema>;

export const milestoneSchema = z.object({
  id: z.string(),
  humanKey: z.string(),
  title: z.string(),
  dueDate: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  percentComplete: z.number(),
  assignee: personSchema.nullable(),
  deliverablesTotal: z.number(),
  deliverablesAccepted: z.number(),
  isOverdue: z.boolean(),
});
export type MilestoneDto = z.infer<typeof milestoneSchema>;

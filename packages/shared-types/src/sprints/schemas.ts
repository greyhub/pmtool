import { z } from 'zod';

export const ESTIMATION_UNITS = ['POINTS', 'HOURS'] as const;
export type EstimationUnit = (typeof ESTIMATION_UNITS)[number];

export const SPRINT_STATUSES = ['PLANNED', 'ACTIVE', 'CLOSED'] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export const createSprintSchema = z
  .object({
    name: z.string().min(1).max(120),
    goal: z.string().max(1000).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((v) => new Date(v.startDate) <= new Date(v.endDate), { message: 'Ngày kết thúc phải sau ngày bắt đầu' });
export type CreateSprintInput = z.infer<typeof createSprintSchema>;

export const updateSprintSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: z.string().max(1000).nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;

/** What happens to unfinished work when a sprint closes: another sprint, or back to the backlog (null). */
export const closeSprintSchema = z.object({
  moveUnfinishedTo: z.string().nullable().optional(),
});
export type CloseSprintInput = z.infer<typeof closeSprintSchema>;

export const sprintSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  goal: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(SPRINT_STATUSES),
  /** Load in the project's estimation unit: what is planned now, what is done now, and the snapshots. */
  plannedLoad: z.number(),
  doneLoad: z.number(),
  committedLoad: z.number().nullable(),
  completedLoad: z.number().nullable(),
  taskCount: z.number(),
  doneCount: z.number(),
  startedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
});
export type SprintDto = z.infer<typeof sprintSchema>;

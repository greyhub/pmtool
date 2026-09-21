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

export const BURNDOWN_STATUSES = ['not_started', 'ahead', 'on_track', 'behind', 'closed'] as const;
export type BurndownStatus = (typeof BURNDOWN_STATUSES)[number];

export const burndownDaySchema = z.object({
  date: z.string(), // YYYY-MM-DD, Vietnam calendar day
  /** Where the work should stand that day if it burned down evenly from the commitment to zero. */
  ideal: z.number(),
  /** Load still to do at the end of that day; null for days that have not happened (or after the sprint closed). */
  remaining: z.number().nullable(),
  planned: z.number().nullable(),
  done: z.number().nullable(),
  /** True when no snapshot exists for the day and the previous known value was carried forward. */
  estimated: z.boolean(),
});
export type BurndownDayDto = z.infer<typeof burndownDaySchema>;

export const burndownSchema = z.object({
  sprintId: z.string(),
  name: z.string(),
  status: z.enum(SPRINT_STATUSES),
  unit: z.enum(ESTIMATION_UNITS),
  startDate: z.string(),
  endDate: z.string(),
  today: z.string(),
  /** Load committed when the sprint started (null before it starts). */
  committed: z.number().nullable(),
  planned: z.number(),
  done: z.number(),
  remaining: z.number(),
  /** Work added after the start (planned - committed); negative when work was taken out. */
  scopeChange: z.number(),
  days: z.array(burndownDaySchema),
  pace: z.object({
    status: z.enum(BURNDOWN_STATUSES),
    /** remaining - ideal for today: positive = behind the line. */
    deltaVsIdeal: z.number(),
    burnPerDay: z.number(),
    /** What is left at the end date if the pace so far holds. */
    projectedRemainingAtEnd: z.number(),
    /** Days the sprint has run past its end date (active sprints only). */
    overrunDays: z.number(),
  }),
});
export type BurndownDto = z.infer<typeof burndownSchema>;

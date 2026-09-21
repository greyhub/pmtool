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

// ---- Sprint review ---------------------------------------------------------------------------------------------

export const GOAL_RESULTS = ['MET', 'PARTIAL', 'MISSED'] as const;
export type GoalResult = (typeof GOAL_RESULTS)[number];

export const updateReviewSchema = z.object({
  reviewNotes: z.string().max(5000).nullable().optional(),
  goalResult: z.enum(GOAL_RESULTS).nullable().optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const reviewItemSchema = z.object({
  id: z.string(),
  humanKey: z.string(),
  title: z.string(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED']),
  /** Size in the project's unit; unsized work is 0. */
  load: z.number(),
  /** Joined the sprint after it had started. */
  addedMidSprint: z.boolean(),
  assignee: z.object({ id: z.string(), name: z.string(), character: z.string() }).nullable(),
  /** Where unfinished work went when the sprint closed. */
  carriedTo: z.object({ kind: z.enum(['sprint', 'backlog']), name: z.string().nullable() }).nullable(),
});
export type ReviewItemDto = z.infer<typeof reviewItemSchema>;

export const sprintReviewSchema = z.object({
  sprint: z.object({
    id: z.string(),
    name: z.string(),
    goal: z.string().nullable(),
    status: z.enum(SPRINT_STATUSES),
    startDate: z.string(),
    endDate: z.string(),
    closedAt: z.string().nullable(),
  }),
  unit: z.enum(ESTIMATION_UNITS),
  /** A running sprint's review is a preview: it is measured now and is not final. */
  isPreview: z.boolean(),
  /** False for sprints closed before reviews existed: only totals are known, not which items. */
  detailsAvailable: z.boolean(),
  summary: z.object({
    committed: z.number().nullable(),
    added: z.number(),
    finalPlanned: z.number(),
    completed: z.number(),
    unfinished: z.number(),
    completionPct: z.number(),
    doneCount: z.number(),
    unfinishedCount: z.number(),
    addedCount: z.number(),
  }),
  delivered: z.array(reviewItemSchema),
  unfinished: z.array(reviewItemSchema),
  people: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      character: z.string(),
      doneLoad: z.number(),
      doneCount: z.number(),
      unfinishedCount: z.number(),
    }),
  ),
  /** The latest closed sprints (this one included when closed) for the trend. */
  history: z.array(
    z.object({ id: z.string(), name: z.string(), committed: z.number(), completed: z.number(), isCurrent: z.boolean() }),
  ),
  /** Mean completed load of the previous (up to three) closed sprints; null before there is any. */
  velocityAvg: z.number().nullable(),
  goalResult: z.enum(GOAL_RESULTS).nullable(),
  reviewNotes: z.string().nullable(),
});
export type SprintReviewDto = z.infer<typeof sprintReviewSchema>;

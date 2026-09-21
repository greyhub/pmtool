import { z } from 'zod';
import { TASK_STATUSES } from '../common/enums';

/**
 * The numbers a daily report compares, and which direction is good — so the screen can colour a
 * change without guessing ("overdue went up" is bad, "done went up" is good).
 */
export const REPORT_METRICS = [
  { key: 'progressPct', better: 'up' },
  { key: 'done', better: 'up' },
  { key: 'inProgress', better: 'neutral' },
  { key: 'inReview', better: 'neutral' },
  { key: 'todo', better: 'neutral' },
  { key: 'blocked', better: 'down' },
  { key: 'overdue', better: 'down' },
  { key: 'tasksTotal', better: 'neutral' },
  { key: 'createdCount', better: 'neutral' },
  { key: 'completedCount', better: 'up' },
  { key: 'openRisks', better: 'down' },
  { key: 'openIssues', better: 'down' },
  { key: 'deliverablesAccepted', better: 'up' },
  { key: 'milestonesDone', better: 'up' },
  { key: 'activityCount', better: 'neutral' },
  { key: 'activeUsers', better: 'neutral' },
] as const;
export type ReportMetricKey = (typeof REPORT_METRICS)[number]['key'];

export const dailySnapshotSchema = z.object({
  date: z.string(), // YYYY-MM-DD, Vietnam calendar day
  tasksTotal: z.number(),
  todo: z.number(),
  inProgress: z.number(),
  inReview: z.number(),
  done: z.number(),
  blocked: z.number(),
  overdue: z.number(),
  progressPct: z.number(),
  createdCount: z.number(),
  completedCount: z.number(),
  openRisks: z.number(),
  openIssues: z.number(),
  deliverablesTotal: z.number(),
  deliverablesAccepted: z.number(),
  milestonesTotal: z.number(),
  milestonesDone: z.number(),
  sprintPlanned: z.number().nullable(),
  sprintDone: z.number().nullable(),
  activityCount: z.number(),
  activeUsers: z.number(),
});
export type DailySnapshotDto = z.infer<typeof dailySnapshotSchema>;

export const reportTaskRefSchema = z.object({
  id: z.string(),
  humanKey: z.string(),
  title: z.string(),
  status: z.enum(TASK_STATUSES),
  dueDate: z.string().nullable(),
});
export type ReportTaskRefDto = z.infer<typeof reportTaskRefSchema>;

export const dailyReportSchema = z.object({
  date: z.string(),
  /** Today's report is computed live and keeps changing until the nightly snapshot fixes it. */
  isLive: z.boolean(),
  current: dailySnapshotSchema.nullable(),
  comparedTo: z.string(),
  previous: dailySnapshotSchema.nullable(),
  /** current - previous for each metric; empty when either side is missing. */
  deltas: z.record(z.string(), z.number()),
  trend: z.array(dailySnapshotSchema),
  highlights: z.object({
    completed: z.array(reportTaskRefSchema),
    dueNotDone: z.array(reportTaskRefSchema),
    /** Only for today: what is stuck right now. */
    blocked: z.array(reportTaskRefSchema),
  }),
});
export type DailyReportDto = z.infer<typeof dailyReportSchema>;

export const dailyReportQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compareTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type DailyReportQuery = z.infer<typeof dailyReportQuerySchema>;

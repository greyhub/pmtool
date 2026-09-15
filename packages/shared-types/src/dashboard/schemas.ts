import { z } from 'zod';
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from '../common/enums';

const taskSummarySchema = z.object({
  id: z.string(),
  humanKey: z.string(),
  title: z.string(),
  projectId: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.string().nullable(),
});
export type TaskSummaryDto = z.infer<typeof taskSummarySchema>;

const countsByKey = <T extends readonly string[]>(keys: T) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.number()])) as Record<T[number], z.ZodNumber>);

export const orgDashboardSchema = z.object({
  totalProjects: z.number(),
  projectCounts: countsByKey(PROJECT_STATUSES),
  taskCounts: countsByKey(TASK_STATUSES),
  overdueTasks: z.array(taskSummarySchema),
  openRiskCount: z.number(),
});
export type OrgDashboardDto = z.infer<typeof orgDashboardSchema>;

export const projectDashboardSchema = z.object({
  taskCounts: countsByKey(TASK_STATUSES),
  totalTasks: z.number(),
  completionPercent: z.number(),
  overdueTasks: z.array(taskSummarySchema),
  openRiskCount: z.number(),
  openIssueCount: z.number(),
});
export type ProjectDashboardDto = z.infer<typeof projectDashboardSchema>;

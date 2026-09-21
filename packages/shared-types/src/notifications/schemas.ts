import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES, TASK_ASSIGNEE_ROLES, WBS_NODE_TYPES } from '../common/enums';

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_COMMENT',
  'DELIVERABLE_SUBMITTED',
  'DELIVERABLE_ACCEPTED',
  'DELIVERABLE_REJECTED',
  'DAILY_REPORT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(NOTIFICATION_TYPES),
  actorName: z.string().nullable(),
  entityKind: z.enum(['task', 'deliverable', 'report']),
  entityId: z.string(),
  projectKey: z.string(),
  entityTitle: z.string(),
  detail: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});
export type NotificationDto = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number(),
});
export type NotificationListDto = z.infer<typeof notificationListSchema>;

/** One of my tasks, across every project of the organization. */
export const myTaskSchema = z.object({
  id: z.string(),
  humanKey: z.string(),
  title: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  nodeType: z.enum(WBS_NODE_TYPES),
  isMilestone: z.boolean(),
  dueDate: z.string().nullable(),
  percentComplete: z.number(),
  role: z.enum(TASK_ASSIGNEE_ROLES),
  projectKey: z.string(),
  projectName: z.string(),
});
export type MyTaskDto = z.infer<typeof myTaskSchema>;

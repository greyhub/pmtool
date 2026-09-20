import { z } from 'zod';
import { DEPENDENCY_TYPES, MASCOT_CHARACTERS, TASK_ASSIGNEE_ROLES, TASK_PRIORITIES, TASK_STATUSES } from '../common/enums';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20_000).optional(),
  parentTaskId: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimateHours: z.number().min(0).max(10_000).optional(),
  /** The one accountable person; everyone else helping goes in supporterIds. */
  assigneeId: z.string().optional(),
  supporterIds: z.array(z.string()).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20_000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimateHours: z.number().min(0).max(10_000).nullable().optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  /** null clears the primary assignee; omitted leaves it unchanged. */
  assigneeId: z.string().nullable().optional(),
  /** Replaces the supporter list when present. */
  supporterIds: z.array(z.string()).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  parentTaskId: z.string().nullable().optional(),
  boardColumnId: z.string().nullable().optional(),
  orderIndex: z.number(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

const taskAssigneeSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  mascotCharacter: z.enum(MASCOT_CHARACTERS),
  role: z.enum(TASK_ASSIGNEE_ROLES),
});

export const taskSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  humanKey: z.string(),
  parentTaskId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  estimateHours: z.number().nullable(),
  percentComplete: z.number(),
  orderIndex: z.number(),
  boardColumnId: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assignees: z.array(taskAssigneeSchema),
  subtaskCount: z.number().optional(),
});
export type TaskDto = z.infer<typeof taskSchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10_000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const commentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string(),
  author: z.object({ id: z.string(), fullName: z.string(), avatarUrl: z.string().nullable() }).optional(),
  body: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
});
export type CommentDto = z.infer<typeof commentSchema>;

export const createDependencySchema = z
  .object({
    predecessorId: z.string(),
    successorId: z.string(),
    type: z.enum(DEPENDENCY_TYPES).optional(),
    lagDays: z.number().int().optional(),
  })
  .refine((v) => v.predecessorId !== v.successorId, {
    message: 'Một task không thể phụ thuộc vào chính nó',
    path: ['successorId'],
  });
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;

export const dependencySchema = z.object({
  id: z.string(),
  predecessorId: z.string(),
  successorId: z.string(),
  type: z.enum(DEPENDENCY_TYPES),
  lagDays: z.number(),
});
export type DependencyDto = z.infer<typeof dependencySchema>;

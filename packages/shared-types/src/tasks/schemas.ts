import { z } from 'zod';
import { DEPENDENCY_TYPES, MASCOT_CHARACTERS, TASK_ASSIGNEE_ROLES, TASK_PRIORITIES, TASK_STATUSES, WBS_NODE_TYPES } from '../common/enums';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20_000).optional(),
  parentTaskId: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimateHours: z.number().min(0).max(10_000).optional(),
  /** A zero-duration checkpoint; requires dueDate, and startDate is forced equal to it. */
  isMilestone: z.boolean().optional(),
  /** Relative size for sprint planning. */
  storyPoints: z.number().int().min(0).max(1000).optional(),
  sprintId: z.string().optional(),
  /** PMBOK role in the WBS; defaults to the legal level under the parent. */
  nodeType: z.enum(WBS_NODE_TYPES).optional(),
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
  isMilestone: z.boolean().optional(),
  nodeType: z.enum(WBS_NODE_TYPES).optional(),
  storyPoints: z.number().int().min(0).max(1000).nullable().optional(),
  /** null moves the task back to the backlog. */
  sprintId: z.string().nullable().optional(),
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
  isMilestone: z.boolean(),
  nodeType: z.enum(WBS_NODE_TYPES),
  storyPoints: z.number().nullable(),
  sprintId: z.string().nullable(),
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

const changeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const taskChangeSchema = z.object({
  field: z.string(),
  from: changeValueSchema.optional(),
  to: changeValueSchema.optional(),
  added: z.array(z.string()).optional(),
  removed: z.array(z.string()).optional(),
});
export type TaskChangeDto = z.infer<typeof taskChangeSchema>;

export const taskHistoryEntrySchema = z.object({
  id: z.string(),
  action: z.enum(['created', 'updated']),
  createdAt: z.string(),
  actor: z.object({ id: z.string(), fullName: z.string(), avatarUrl: z.string().nullable() }),
  changes: z.array(taskChangeSchema),
});
export type TaskHistoryEntryDto = z.infer<typeof taskHistoryEntrySchema>;

/** Import a spreadsheet of tasks: `dryRun` validates and previews without creating anything. */
export const importTasksCsvSchema = z.object({
  csv: z.string().min(1).max(1_500_000),
  dryRun: z.boolean().optional(),
});
export type ImportTasksCsvInput = z.infer<typeof importTasksCsvSchema>;

export interface ImportTasksResultDto {
  committed: boolean;
  valid: number;
  errors: { line: number; message: string }[];
  preview: { line: number; title: string; nodeType: string; parent: string | null }[];
}

/**
 * Change many tasks' WBS level at once. Either name the tasks and the level, or
 * ask for `byDepth` (root → phase, child → deliverable, … leaves → activity).
 * `dryRun` reports what would change without writing.
 */
export const bulkNodeTypeSchema = z
  .object({
    taskIds: z.array(z.string()).min(1).max(2000).optional(),
    nodeType: z.enum(WBS_NODE_TYPES).optional(),
    byDepth: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .refine((v) => v.byDepth === true || (v.taskIds && v.nodeType), {
    message: 'Chọn công việc và cấp WBS, hoặc dùng chế độ theo độ sâu',
  });
export type BulkNodeTypeInput = z.infer<typeof bulkNodeTypeSchema>;

export interface BulkNodeTypeResultDto {
  committed: boolean;
  /** Tasks whose level changes (or changed). */
  changed: number;
  /** How many tasks end up at each level after the change. */
  counts: Record<(typeof WBS_NODE_TYPES)[number], number>;
  errors: { taskId: string; humanKey: string; message: string }[];
}

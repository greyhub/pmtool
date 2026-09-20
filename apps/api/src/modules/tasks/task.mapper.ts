import { Task, TaskAssignee, User } from '@prisma/client';
import { TaskDto } from '@pmtool/shared-types';
import { fromRichText } from './rich-text.util';

type TaskWithRelations = Task & {
  assignees?: (TaskAssignee & {
    user: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'mascotCharacter'>;
  })[];
  _count?: { subtasks: number };
};

export function toTaskDto(task: TaskWithRelations): TaskDto {
  return {
    id: task.id,
    organizationId: task.organizationId,
    projectId: task.projectId,
    humanKey: task.humanKey,
    parentTaskId: task.parentTaskId,
    title: task.title,
    description: fromRichText(task.description),
    status: task.status,
    priority: task.priority,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    estimateHours: task.estimateHours,
    percentComplete: task.percentComplete,
    orderIndex: task.orderIndex,
    boardColumnId: task.boardColumnId,
    createdById: task.createdById,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    assignees: (task.assignees ?? []).map((a) => ({
      id: a.user.id,
      fullName: a.user.fullName,
      avatarUrl: a.user.avatarUrl,
      mascotCharacter: a.user
        .mascotCharacter as TaskDto['assignees'][number]['mascotCharacter'],
    })),
    subtaskCount: task._count?.subtasks,
  };
}

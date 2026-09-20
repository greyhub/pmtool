import { Deliverable, Task, User } from '@prisma/client';
import { DeliverableDto } from '@pmtool/shared-types';

type Person = Pick<User, 'id' | 'fullName' | 'avatarUrl'>;

export type DeliverableWithRelations = Deliverable & {
  owner?: Person | null;
  reviewedBy?: Person | null;
  task?: Pick<Task, 'id' | 'humanKey' | 'title' | 'isMilestone'> | null;
};

const toPerson = (p?: Person | null) =>
  p ? { id: p.id, fullName: p.fullName, avatarUrl: p.avatarUrl } : null;

export function toDeliverableDto(d: DeliverableWithRelations): DeliverableDto {
  return {
    id: d.id,
    organizationId: d.organizationId,
    projectId: d.projectId,
    taskId: d.taskId,
    task: d.task
      ? {
          id: d.task.id,
          humanKey: d.task.humanKey,
          title: d.task.title,
          isMilestone: d.task.isMilestone,
        }
      : null,
    name: d.name,
    description: d.description,
    acceptanceCriteria: d.acceptanceCriteria,
    status: d.status,
    ownerId: d.ownerId,
    owner: toPerson(d.owner),
    dueDate: d.dueDate?.toISOString() ?? null,
    url: d.url,
    submittedAt: d.submittedAt?.toISOString() ?? null,
    reviewedBy: toPerson(d.reviewedBy),
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
    rejectionReason: d.rejectionReason,
    createdById: d.createdById,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

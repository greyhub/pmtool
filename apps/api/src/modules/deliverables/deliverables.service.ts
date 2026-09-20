import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Deliverable } from '@prisma/client';
import {
  CreateDeliverableInput,
  UpdateDeliverableInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const PERSON_SELECT = { id: true, fullName: true, avatarUrl: true } as const;
const INCLUDE = {
  owner: { select: PERSON_SELECT },
  reviewedBy: { select: PERSON_SELECT },
  task: {
    select: { id: true, humanKey: true, title: true, isMilestone: true },
  },
} as const;

/** Sign-off state that stops describing the deliverable once its content changes. */
const RESET_REVIEW = {
  status: 'IN_PROGRESS' as const,
  submittedAt: null,
  reviewedById: null,
  reviewedAt: null,
  rejectionReason: null,
};

@Injectable()
export class DeliverablesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, projectId: string) {
    return this.prisma.db.deliverable.findMany({
      where: { organizationId, projectId },
      include: INCLUDE,
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    input: CreateDeliverableInput,
  ) {
    await this.assertTaskInProject(organizationId, projectId, input.taskId);
    return this.prisma.db.deliverable.create({
      data: {
        organizationId,
        projectId,
        taskId: input.taskId,
        name: input.name,
        description: input.description,
        acceptanceCriteria: input.acceptanceCriteria,
        ownerId: input.ownerId,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        url: input.url,
        createdById: userId,
      },
      include: INCLUDE,
    });
  }

  async update(
    organizationId: string,
    projectId: string,
    deliverableId: string,
    input: UpdateDeliverableInput,
  ) {
    const existing = await this.findOrThrow(
      organizationId,
      projectId,
      deliverableId,
    );
    if (input.taskId) {
      await this.assertTaskInProject(organizationId, projectId, input.taskId);
    }

    const contentChanged =
      (input.name !== undefined && input.name !== existing.name) ||
      (input.description !== undefined &&
        input.description !== existing.description) ||
      (input.acceptanceCriteria !== undefined &&
        input.acceptanceCriteria !== existing.acceptanceCriteria) ||
      (input.url !== undefined && input.url !== existing.url);
    const beyondWork = ['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(
      existing.status,
    );
    // Editing the content (or explicitly reopening) of a submitted/reviewed
    // deliverable withdraws the submission and any sign-off.
    const reopens =
      beyondWork && (contentChanged || input.status !== undefined);

    return this.prisma.db.deliverable.update({
      where: { id: deliverableId },
      data: {
        name: input.name,
        description: input.description,
        acceptanceCriteria: input.acceptanceCriteria,
        taskId: input.taskId,
        ownerId: input.ownerId,
        dueDate:
          input.dueDate === undefined
            ? undefined
            : input.dueDate
              ? new Date(input.dueDate)
              : null,
        url: input.url,
        ...(reopens
          ? { ...RESET_REVIEW, status: input.status ?? 'IN_PROGRESS' }
          : input.status !== undefined
            ? { status: input.status }
            : {}),
      },
      include: INCLUDE,
    });
  }

  async submit(organizationId: string, projectId: string, id: string) {
    const existing = await this.findOrThrow(organizationId, projectId, id);
    if (existing.status === 'SUBMITTED' || existing.status === 'ACCEPTED') {
      throw new ConflictException(
        existing.status === 'ACCEPTED'
          ? 'Giao phẩm đã được nghiệm thu'
          : 'Giao phẩm đã được nộp và đang chờ nghiệm thu',
      );
    }
    return this.prisma.db.deliverable.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      },
      include: INCLUDE,
    });
  }

  async accept(
    organizationId: string,
    projectId: string,
    id: string,
    reviewerId: string,
  ) {
    await this.assertSubmitted(organizationId, projectId, id);
    return this.prisma.db.deliverable.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      include: INCLUDE,
    });
  }

  async reject(
    organizationId: string,
    projectId: string,
    id: string,
    reviewerId: string,
    reason: string,
  ) {
    await this.assertSubmitted(organizationId, projectId, id);
    return this.prisma.db.deliverable.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: INCLUDE,
    });
  }

  async remove(organizationId: string, projectId: string, id: string) {
    await this.findOrThrow(organizationId, projectId, id);
    await this.prisma.db.deliverable.delete({ where: { id } });
  }

  private async assertSubmitted(
    organizationId: string,
    projectId: string,
    id: string,
  ) {
    const existing = await this.findOrThrow(organizationId, projectId, id);
    if (existing.status !== 'SUBMITTED') {
      throw new ConflictException(
        'Chỉ giao phẩm đã nộp mới có thể nghiệm thu hoặc từ chối',
      );
    }
  }

  private async findOrThrow(
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<Deliverable> {
    const found = await this.prisma.db.deliverable.findUnique({
      where: { id },
    });
    if (
      !found ||
      found.organizationId !== organizationId ||
      found.projectId !== projectId
    ) {
      throw new NotFoundException('Không tìm thấy giao phẩm');
    }
    return found;
  }

  private async assertTaskInProject(
    organizationId: string,
    projectId: string,
    taskId: string | undefined | null,
  ) {
    if (!taskId) return;
    const task = await this.prisma.db.task.findUnique({
      where: { id: taskId },
    });
    if (
      !task ||
      task.organizationId !== organizationId ||
      task.projectId !== projectId
    ) {
      throw new BadRequestException(
        'Công việc/mốc liên kết phải thuộc cùng dự án',
      );
    }
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import {
  CreateTaskInput,
  MoveTaskInput,
  UpdateTaskInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { toRichText } from './rich-text.util';
import { GamificationService } from '../gamification/gamification.service';
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service';

const TASK_INCLUDE = {
  assignees: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          mascotCharacter: true,
        },
      },
    },
  },
  _count: { select: { subtasks: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
    private readonly telegramNotifications: TelegramNotificationsService,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    createdById: string,
    input: CreateTaskInput,
  ) {
    if (input.parentTaskId) {
      await this.assertTaskInProject(
        organizationId,
        input.parentTaskId,
        projectId,
      );
    }

    const task = await this.prisma.db.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: { taskSequence: { increment: 1 } },
      });
      const humanKey = `${project.key}-${project.taskSequence}`;

      const firstColumn = await tx.boardColumn.findFirst({
        where: { projectId },
        orderBy: { orderIndex: 'asc' },
      });

      return tx.task.create({
        data: {
          organizationId,
          projectId,
          humanKey,
          parentTaskId: input.parentTaskId,
          title: input.title,
          description: input.description
            ? toRichText(input.description)
            : undefined,
          priority: input.priority,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          estimateHours: input.estimateHours,
          orderIndex: Date.now(),
          boardColumnId: firstColumn?.id,
          createdById,
          assignees: input.assigneeIds?.length
            ? {
                createMany: {
                  data: input.assigneeIds.map((userId) => ({
                    organizationId,
                    userId,
                  })),
                },
              }
            : undefined,
        },
        include: TASK_INCLUDE,
      });
    });

    await this.gamificationService.awardPoints(
      organizationId,
      createdById,
      5,
      'task_created',
    );
    if (input.assigneeIds?.length) {
      await this.telegramNotifications.notifyTaskAssigned(
        task,
        input.assigneeIds,
      );
    }
    return task;
  }

  async list(
    organizationId: string,
    projectId: string,
    parentTaskId?: string | null,
  ) {
    return this.prisma.db.task.findMany({
      where: {
        organizationId,
        projectId,
        ...(parentTaskId === undefined ? {} : { parentTaskId }),
      },
      include: TASK_INCLUDE,
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findByIdOrThrow(organizationId: string, taskId: string) {
    const task = await this.prisma.db.task.findUnique({
      where: { id: taskId },
      include: TASK_INCLUDE,
    });
    if (!task || task.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy công việc');
    }
    return task;
  }

  async update(
    organizationId: string,
    taskId: string,
    input: UpdateTaskInput,
    actingUserId: string,
  ) {
    const existing = await this.findByIdOrThrow(organizationId, taskId);

    const updated = await this.prisma.db.$transaction(async (tx) => {
      if (input.assigneeIds) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (input.assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: input.assigneeIds.map((userId) => ({
              organizationId,
              taskId,
              userId,
            })),
          });
        }
      }

      return tx.task.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description:
            input.description === undefined
              ? undefined
              : input.description === null
                ? Prisma.JsonNull
                : toRichText(input.description),
          status: input.status,
          priority: input.priority,
          startDate:
            input.startDate === undefined
              ? undefined
              : input.startDate
                ? new Date(input.startDate)
                : null,
          dueDate:
            input.dueDate === undefined
              ? undefined
              : input.dueDate
                ? new Date(input.dueDate)
                : null,
          // A changed due date invalidates any reminder already sent for the old one.
          telegramReminderSentAt:
            input.dueDate === undefined ? undefined : null,
          estimateHours: input.estimateHours,
        },
        include: TASK_INCLUDE,
      });
    });

    if (existing.status !== 'DONE' && updated.status === 'DONE') {
      await this.gamificationService.awardPoints(
        organizationId,
        actingUserId,
        10,
        'task_completed',
      );
    }

    if (input.assigneeIds) {
      const oldAssigneeIds = new Set(existing.assignees.map((a) => a.userId));
      const newlyAssigned = input.assigneeIds.filter(
        (id) => !oldAssigneeIds.has(id),
      );
      if (newlyAssigned.length > 0) {
        await this.telegramNotifications.notifyTaskAssigned(
          updated,
          newlyAssigned,
        );
      }
    }

    return updated;
  }

  async remove(organizationId: string, taskId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, taskId);
    await this.prisma.db.task.delete({ where: { id: taskId } });
  }

  async move(
    organizationId: string,
    taskId: string,
    input: MoveTaskInput,
  ): Promise<Task> {
    const task = await this.findByIdOrThrow(organizationId, taskId);

    if (input.parentTaskId !== undefined && input.parentTaskId !== null) {
      if (input.parentTaskId === taskId) {
        throw new BadRequestException(
          'Một công việc không thể là công việc cha của chính nó',
        );
      }
      await this.assertTaskInProject(
        organizationId,
        input.parentTaskId,
        task.projectId,
      );
      if (await this.isDescendant(organizationId, input.parentTaskId, taskId)) {
        throw new BadRequestException(
          'Không thể chuyển vào một công việc con của chính nó (tạo vòng lặp)',
        );
      }
    }

    if (input.boardColumnId) {
      const column = await this.prisma.db.boardColumn.findUnique({
        where: { id: input.boardColumnId },
      });
      if (
        !column ||
        column.organizationId !== organizationId ||
        column.projectId !== task.projectId
      ) {
        throw new BadRequestException('Cột bảng không hợp lệ');
      }
    }

    return this.prisma.db.task.update({
      where: { id: taskId },
      data: {
        parentTaskId: input.parentTaskId,
        boardColumnId: input.boardColumnId,
        orderIndex: input.orderIndex,
      },
    });
  }

  private async assertTaskInProject(
    organizationId: string,
    taskId: string,
    projectId: string,
  ): Promise<void> {
    const task = await this.prisma.db.task.findUnique({
      where: { id: taskId },
    });
    if (
      !task ||
      task.organizationId !== organizationId ||
      task.projectId !== projectId
    ) {
      throw new BadRequestException(
        'Công việc cha không hợp lệ hoặc thuộc dự án khác',
      );
    }
  }

  /** True if `candidateNewParentId` is `taskId` itself or already sits somewhere inside `taskId`'s own subtree — i.e. re-parenting `taskId` under it would create a cycle. */
  private async isDescendant(
    organizationId: string,
    candidateNewParentId: string,
    taskId: string,
  ): Promise<boolean> {
    let currentId: string | null = candidateNewParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === taskId) return true;
      if (visited.has(currentId)) return false; // defensive: pre-existing corrupt cycle, don't loop forever
      visited.add(currentId);
      const current: { parentTaskId: string | null } | null =
        await this.prisma.db.task.findFirst({
          where: { id: currentId, organizationId },
          select: { parentTaskId: true },
        });
      currentId = current?.parentTaskId ?? null;
    }
    return false;
  }
}

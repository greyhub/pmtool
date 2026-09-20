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
import { addActivityMetadata } from '../../common/context/request-context';
import { diffTask, TaskSnapshot } from './task-changes';
import { GamificationService } from '../gamification/gamification.service';
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service';

type TaskWithAssignees = Awaited<ReturnType<TasksService['findByIdOrThrow']>>;

function snapshot(task: TaskWithAssignees): TaskSnapshot {
  const names = (role: 'PRIMARY' | 'SUPPORT') =>
    task.assignees.filter((a) => a.role === role).map((a) => a.user.fullName);
  return {
    title: task.title,
    description:
      task.description === null ? null : JSON.stringify(task.description),
    status: task.status,
    priority: task.priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    percentComplete: task.percentComplete,
    isMilestone: task.isMilestone,
    assignee: names('PRIMARY')[0] ?? null,
    supporters: names('SUPPORT'),
  };
}

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

interface AssigneeRow {
  userId: string;
  role: 'PRIMARY' | 'SUPPORT';
}

/**
 * One PRIMARY (the accountable person) plus any number of SUPPORT. A user
 * can only appear once, so the primary wins if they're also listed as a
 * supporter — the DB enforces one PRIMARY per task with a partial unique index.
 */
function toAssigneeRows(
  primaryId: string | null | undefined,
  supporterIds: string[] | undefined,
): AssigneeRow[] {
  const rows: AssigneeRow[] = [];
  if (primaryId) rows.push({ userId: primaryId, role: 'PRIMARY' });
  for (const userId of new Set(supporterIds ?? [])) {
    if (userId !== primaryId) rows.push({ userId, role: 'SUPPORT' });
  }
  return rows;
}

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

    if (input.isMilestone && !input.dueDate) {
      throw new BadRequestException('Mốc quan trọng cần có ngày đến hạn');
    }

    const initialAssignees = toAssigneeRows(
      input.assigneeId,
      input.supporterIds,
    );

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
          // A milestone has no duration: it starts the day it's due.
          startDate: input.isMilestone
            ? input.dueDate
              ? new Date(input.dueDate)
              : undefined
            : input.startDate
              ? new Date(input.startDate)
              : undefined,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          isMilestone: input.isMilestone,
          estimateHours: input.estimateHours,
          orderIndex: Date.now(),
          boardColumnId: firstColumn?.id,
          createdById,
          assignees: initialAssignees.length
            ? {
                createMany: {
                  data: initialAssignees.map((a) => ({
                    organizationId,
                    ...a,
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
    if (input.assigneeId) {
      await this.telegramNotifications.notifyTaskAssigned(task, [
        input.assigneeId,
      ]);
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

    // Either field present means "rewrite the assignment"; whichever half
    // wasn't sent keeps its current value.
    const existingPrimaryId =
      existing.assignees.find((a) => a.role === 'PRIMARY')?.userId ?? null;
    const nextAssignees =
      input.assigneeId !== undefined || input.supporterIds !== undefined
        ? toAssigneeRows(
            input.assigneeId !== undefined
              ? input.assigneeId
              : existingPrimaryId,
            input.supporterIds ??
              existing.assignees
                .filter((a) => a.role === 'SUPPORT')
                .map((a) => a.userId),
          )
        : null;

    // While a task is (or is becoming) a milestone, its start always follows its due date.
    const willBeMilestone = input.isMilestone ?? existing.isMilestone;
    const nextDueDate =
      input.dueDate === undefined ? existing.dueDate : input.dueDate;
    if (willBeMilestone && !nextDueDate) {
      throw new BadRequestException('Mốc quan trọng cần có ngày đến hạn');
    }
    const milestoneStart =
      willBeMilestone &&
      (input.isMilestone === true || input.dueDate !== undefined)
        ? new Date(nextDueDate as Date | string)
        : undefined;

    const updated = await this.prisma.db.$transaction(async (tx) => {
      if (nextAssignees) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (nextAssignees.length > 0) {
          await tx.taskAssignee.createMany({
            data: nextAssignees.map((a) => ({ organizationId, taskId, ...a })),
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
          startDate: milestoneStart
            ? milestoneStart
            : input.startDate === undefined
              ? undefined
              : input.startDate
                ? new Date(input.startDate)
                : null,
          isMilestone: input.isMilestone,
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
          percentComplete: input.percentComplete,
        },
        include: TASK_INCLUDE,
      });
    });

    const changes = diffTask(snapshot(existing), snapshot(updated));
    if (changes.length > 0) addActivityMetadata({ changes });

    if (existing.status !== 'DONE' && updated.status === 'DONE') {
      await this.gamificationService.awardPoints(
        organizationId,
        actingUserId,
        10,
        'task_completed',
      );
    }

    if (
      input.percentComplete !== undefined &&
      input.percentComplete !== existing.percentComplete
    ) {
      await this.gamificationService.recordProgressUpdate(
        organizationId,
        actingUserId,
      );
    }

    // Only the primary is told about a new assignment — supporters aren't
    // being handed accountability.
    const nextPrimaryId =
      nextAssignees?.find((a) => a.role === 'PRIMARY')?.userId ?? null;
    if (nextPrimaryId && nextPrimaryId !== existingPrimaryId) {
      await this.telegramNotifications.notifyTaskAssigned(updated, [
        nextPrimaryId,
      ]);
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

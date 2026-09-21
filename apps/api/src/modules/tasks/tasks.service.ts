import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import {
  CreateTaskInput,
  MoveTaskInput,
  UpdateTaskInput,
  WbsNodeType,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { toRichText } from './rich-text.util';
import { assertRetypeFits, placeChild } from './wbs-rules';
import { assertOrgMembers } from '../../common/guards/org-members.util';
import { addActivityMetadata } from '../../common/context/request-context';
import { diffTask, TaskSnapshot } from './task-changes';
import { GamificationService } from '../gamification/gamification.service';
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

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

/** Every column the list needs — all but the (potentially large) rich-text description. */
const TASK_LIST_SELECT = {
  id: true,
  organizationId: true,
  projectId: true,
  humanKey: true,
  parentTaskId: true,
  title: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  estimateHours: true,
  percentComplete: true,
  isMilestone: true,
  nodeType: true,
  storyPoints: true,
  sprintId: true,
  orderIndex: true,
  boardColumnId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
    @Optional() private readonly notifications?: NotificationsService,
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

    const parentType = input.parentTaskId
      ? ((
          await this.prisma.db.task.findUnique({
            where: { id: input.parentTaskId },
            select: { nodeType: true },
          })
        )?.nodeType ?? null)
      : null;
    const placement = placeChild(parentType, input.nodeType);
    await this.assertSprintUsable(organizationId, projectId, input.sprintId);

    const initialAssignees = toAssigneeRows(
      input.assigneeId,
      input.supporterIds,
    );
    await assertOrgMembers(
      this.prisma,
      organizationId,
      initialAssignees.map((a) => a.userId),
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

      if (placement.promoteParentTo && input.parentTaskId) {
        await tx.task.update({
          where: { id: input.parentTaskId },
          data: { nodeType: placement.promoteParentTo },
        });
      }

      return tx.task.create({
        data: {
          organizationId,
          projectId,
          humanKey,
          parentTaskId: input.parentTaskId,
          nodeType: placement.nodeType,
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
          storyPoints: input.storyPoints,
          sprintId: input.sprintId,
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
    await this.notifications?.notify({
      organizationId,
      userIds: initialAssignees.map((a) => a.userId),
      type: 'TASK_ASSIGNED',
      actorId: createdById,
      entityKind: 'task',
      entityId: task.id,
      projectKey: task.humanKey.split('-')[0]!,
      entityTitle: task.title,
    });
    return task;
  }

  /**
   * The project's task list, built for speed: it is fetched by every list, board, WBS and Gantt view and again
   * after each change. So it skips the rich-text description (only the task page needs it; it comes back as
   * null here) and assembles assignees and subtask counts from three flat queries instead of a per-row join —
   * about twice as fast on a 2,500-task project.
   */
  async list(
    organizationId: string,
    projectId: string,
    parentTaskId?: string | null,
  ) {
    const where = {
      organizationId,
      projectId,
      ...(parentTaskId === undefined ? {} : { parentTaskId }),
    };
    const [rows, assignees, subtaskCounts] = await Promise.all([
      this.prisma.db.task.findMany({
        where,
        select: TASK_LIST_SELECT,
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.db.taskAssignee.findMany({
        where: { task: where },
        select: { taskId: true, userId: true, role: true },
      }),
      this.prisma.db.task.groupBy({
        by: ['parentTaskId'],
        where: { organizationId, projectId, parentTaskId: { not: null } },
        _count: true,
      }),
    ]);
    const users = assignees.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: [...new Set(assignees.map((a) => a.userId))] } },
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            mascotCharacter: true,
          },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    const assigneesByTask = new Map<
      string,
      { role: 'PRIMARY' | 'SUPPORT'; user: (typeof users)[number] }[]
    >();
    for (const a of assignees) {
      const user = userById.get(a.userId);
      if (!user) continue;
      const list = assigneesByTask.get(a.taskId) ?? [];
      list.push({ role: a.role, user });
      assigneesByTask.set(a.taskId, list);
    }
    const countByParent = new Map(
      subtaskCounts.map((c) => [c.parentTaskId, c._count]),
    );
    return rows.map((row) => ({
      ...row,
      description: null,
      assignees: assigneesByTask.get(row.id) ?? [],
      _count: { subtasks: countByParent.get(row.id) ?? 0 },
    }));
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
    await this.assertSprintUsable(
      organizationId,
      existing.projectId,
      input.sprintId,
    );

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
    if (nextAssignees) {
      await assertOrgMembers(
        this.prisma,
        organizationId,
        nextAssignees.map((a) => a.userId),
      );
    }

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

    if (input.nodeType !== undefined && input.nodeType !== existing.nodeType) {
      const [parent, children] = await Promise.all([
        existing.parentTaskId
          ? this.prisma.db.task.findUnique({
              where: { id: existing.parentTaskId },
              select: { nodeType: true },
            })
          : null,
        this.prisma.db.task.findMany({
          where: { parentTaskId: existing.id },
          select: { nodeType: true },
        }),
      ]);
      assertRetypeFits(
        input.nodeType,
        parent?.nodeType ?? null,
        children.map((c) => c.nodeType),
      );
    }

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
          // Reaching DONE stamps the moment (daily reports count work finished per day); leaving DONE clears it.
          completedAt:
            input.status === undefined || input.status === existing.status
              ? undefined
              : input.status === 'DONE'
                ? new Date()
                : null,
          priority: input.priority,
          startDate: milestoneStart
            ? milestoneStart
            : input.startDate === undefined
              ? undefined
              : input.startDate
                ? new Date(input.startDate)
                : null,
          isMilestone: input.isMilestone,
          nodeType: input.nodeType,
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
          storyPoints: input.storyPoints,
          sprintId: input.sprintId,
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
    if (nextAssignees) {
      // In-app: everyone newly put on the task, primary or supporter.
      const before = new Set(existing.assignees.map((a) => a.userId));
      await this.notifications?.notify({
        organizationId,
        userIds: nextAssignees
          .filter((a) => !before.has(a.userId))
          .map((a) => a.userId),
        type: 'TASK_ASSIGNED',
        actorId: actingUserId,
        entityKind: 'task',
        entityId: updated.id,
        projectKey: updated.humanKey.split('-')[0]!,
        entityTitle: updated.title,
      });
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

    let movedType: WbsNodeType | undefined;
    if (input.parentTaskId) {
      const parent = await this.prisma.db.task.findUnique({
        where: { id: input.parentTaskId },
        select: { nodeType: true },
      });
      const placement = placeChild(parent?.nodeType ?? null, task.nodeType);
      if (placement.promoteParentTo) {
        await this.prisma.db.task.update({
          where: { id: input.parentTaskId },
          data: { nodeType: placement.promoteParentTo },
        });
      }
      if (placement.nodeType !== task.nodeType) movedType = placement.nodeType;
    }

    return this.prisma.db.task.update({
      where: { id: taskId },
      data: {
        nodeType: movedType,
        parentTaskId: input.parentTaskId,
        boardColumnId: input.boardColumnId,
        orderIndex: input.orderIndex,
      },
    });
  }

  /** A sprint may only be used from its own project, and a closed sprint takes no more work. */
  private async assertSprintUsable(
    organizationId: string,
    projectId: string,
    sprintId: string | null | undefined,
  ): Promise<void> {
    if (!sprintId) return;
    const sprint = await this.prisma.db.sprint.findUnique({
      where: { id: sprintId },
      select: { organizationId: true, projectId: true, status: true },
    });
    if (
      !sprint ||
      sprint.organizationId !== organizationId ||
      sprint.projectId !== projectId
    ) {
      throw new BadRequestException('Sprint không thuộc dự án này');
    }
    if (sprint.status === 'CLOSED') {
      throw new BadRequestException(
        'Sprint đã đóng, không thể thêm công việc vào',
      );
    }
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

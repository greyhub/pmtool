import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma, Project, Sprint } from '@prisma/client';
import {
  BurndownDto,
  CloseSprintInput,
  CreateSprintInput,
  SprintDto,
  UpdateSprintInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { totals } from './sprint-load';
import { vnDateKey } from '../gamification/streak-date.util';
import { buildBurndown } from './burndown-math';

const TASK_LOAD = {
  status: true,
  storyPoints: true,
  estimateHours: true,
} as const;

@Injectable()
export class SprintsService {
  private readonly logger = new Logger(SprintsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertEnabled(project: Project) {
    if (!project.sprintsEnabled) {
      throw new ConflictException(
        'Dự án chưa bật chế độ sprint (Cài đặt dự án → Sprint)',
      );
    }
  }

  private toDto(
    sprint: Sprint,
    tasks: {
      status: string;
      storyPoints: number | null;
      estimateHours: number | null;
    }[],
    project: Project,
  ): SprintDto {
    return {
      id: sprint.id,
      projectId: sprint.projectId,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      status: sprint.status,
      ...totals(tasks, project.estimationUnit),
      committedLoad: sprint.committedLoad,
      completedLoad: sprint.completedLoad,
      startedAt: sprint.startedAt?.toISOString() ?? null,
      closedAt: sprint.closedAt?.toISOString() ?? null,
    };
  }

  async list(project: Project): Promise<SprintDto[]> {
    const sprints = await this.prisma.db.sprint.findMany({
      where: { projectId: project.id },
      include: { tasks: { select: TASK_LOAD } },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return sprints.map(({ tasks, ...s }) => this.toDto(s, tasks, project));
  }

  private async one(project: Project, id: string) {
    const sprint = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
      include: { tasks: { select: TASK_LOAD } },
    });
    const { tasks, ...s } = sprint;
    return this.toDto(s, tasks, project);
  }

  async create(
    project: Project,
    createdById: string,
    input: CreateSprintInput,
  ): Promise<SprintDto> {
    this.assertEnabled(project);
    const sprint = await this.prisma.db.sprint.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        name: input.name,
        goal: input.goal,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        createdById,
      },
    });
    return this.one(project, sprint.id);
  }

  async update(
    project: Project,
    id: string,
    input: UpdateSprintInput,
  ): Promise<SprintDto> {
    const existing = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
    });
    if (existing.status === 'CLOSED')
      throw new ConflictException('Sprint đã đóng, không thể sửa');
    const start = input.startDate
      ? new Date(input.startDate)
      : existing.startDate;
    const end = input.endDate ? new Date(input.endDate) : existing.endDate;
    if (start > end)
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    await this.prisma.db.sprint.update({
      where: { id },
      data: {
        name: input.name,
        goal: input.goal,
        startDate: input.startDate ? start : undefined,
        endDate: input.endDate ? end : undefined,
      },
    });
    return this.one(project, id);
  }

  async start(project: Project, id: string): Promise<SprintDto> {
    this.assertEnabled(project);
    const sprint = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
      include: { tasks: { select: TASK_LOAD } },
    });
    if (sprint.status !== 'PLANNED')
      throw new ConflictException(
        'Chỉ sprint đang ở trạng thái Kế hoạch mới bắt đầu được',
      );
    const running = await this.prisma.db.sprint.findFirst({
      where: { projectId: project.id, status: 'ACTIVE' },
    });
    if (running)
      throw new ConflictException(
        `Đang có sprint chạy ("${running.name}") — hãy đóng nó trước`,
      );
    try {
      await this.prisma.db.sprint.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
          committedLoad: totals(sprint.tasks, project.estimationUnit)
            .plannedLoad,
        },
      });
    } catch (err) {
      // The partial unique index is the final word if two starts race.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Đang có sprint chạy — hãy đóng nó trước');
      }
      throw err;
    }
    // Day one of the burndown: the commitment, with nothing burned yet.
    await this.writeSnapshot(sprint.id, project, sprint.tasks, vnDateKey());
    return this.one(project, id);
  }

  async close(
    project: Project,
    id: string,
    input: CloseSprintInput,
  ): Promise<SprintDto> {
    const sprint = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
      include: { tasks: { select: { id: true, ...TASK_LOAD } } },
    });
    if (sprint.status !== 'ACTIVE')
      throw new ConflictException('Chỉ sprint đang chạy mới đóng được');

    const target = input.moveUnfinishedTo ?? null;
    if (target) {
      const t = await this.prisma.db.sprint.findUnique({
        where: { id: target },
      });
      if (!t || t.projectId !== project.id || t.status !== 'PLANNED') {
        throw new BadRequestException(
          'Chỉ chuyển việc dở sang một sprint đang ở trạng thái Kế hoạch của cùng dự án',
        );
      }
    }
    const unfinished = sprint.tasks
      .filter((t) => t.status !== 'DONE')
      .map((t) => t.id);
    const completedLoad = totals(sprint.tasks, project.estimationUnit).doneLoad;
    // The outcome, recorded before unfinished work leaves the sprint.
    await this.writeSnapshot(sprint.id, project, sprint.tasks, vnDateKey());
    await this.prisma.db.$transaction([
      this.prisma.db.task.updateMany({
        where: { id: { in: unfinished } },
        data: { sprintId: target },
      }),
      this.prisma.db.sprint.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date(), completedLoad },
      }),
    ]);
    return this.one(project, id);
  }

  private async writeSnapshot(
    sprintId: string,
    project: Project,
    tasks: {
      status: string;
      storyPoints: number | null;
      estimateHours: number | null;
    }[],
    dateKey: string,
  ): Promise<void> {
    const t = totals(tasks, project.estimationUnit);
    const generatedAt = new Date();
    const date = new Date(`${dateKey}T00:00:00Z`);
    const data = {
      planned: t.plannedLoad,
      done: t.doneLoad,
      taskCount: t.taskCount,
      doneCount: t.doneCount,
      generatedAt,
    };
    await this.prisma.db.sprintDailySnapshot.upsert({
      where: { sprintId_date: { sprintId, date } },
      create: {
        organizationId: project.organizationId,
        sprintId,
        date,
        ...data,
      },
      update: data,
    });
  }

  /** Nightly: fix today's point of every running sprint's burndown. */
  async snapshotActive(now: Date = new Date()): Promise<number> {
    const dateKey = vnDateKey(now);
    const sprints = await this.prisma.db.sprint.findMany({
      where: { status: 'ACTIVE', project: { status: { not: 'ARCHIVED' } } },
      include: { project: true, tasks: { select: TASK_LOAD } },
    });
    let n = 0;
    for (const sprint of sprints) {
      try {
        await this.writeSnapshot(
          sprint.id,
          sprint.project,
          sprint.tasks,
          dateKey,
        );
        n += 1;
      } catch (err) {
        this.logger.warn(
          `Sprint snapshot failed for ${sprint.id}: ${(err as Error).message}`,
        );
      }
    }
    return n;
  }

  /** The burndown of a running or finished sprint; a running sprint's today is measured live. */
  async burndown(project: Project, id: string): Promise<BurndownDto> {
    const sprint = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
      include: { tasks: { select: TASK_LOAD } },
    });
    const todayKey = vnDateKey();
    if (sprint.status === 'ACTIVE') {
      await this.writeSnapshot(sprint.id, project, sprint.tasks, todayKey);
    }
    const rows = await this.prisma.db.sprintDailySnapshot.findMany({
      where: { sprintId: id },
      orderBy: { date: 'asc' },
    });
    const startKey = vnDateKey(sprint.startDate);
    const endKey = vnDateKey(sprint.endDate);
    const built = buildBurndown({
      startKey,
      endKey,
      todayKey,
      status: sprint.status,
      committed: sprint.committedLoad,
      closedKey: sprint.closedAt ? vnDateKey(sprint.closedAt) : null,
      snapshots: rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        planned: r.planned,
        done: r.done,
      })),
    });
    const { endKey: _lastKey, ...rest } = built;
    return {
      sprintId: sprint.id,
      name: sprint.name,
      status: sprint.status,
      unit: project.estimationUnit,
      startDate: startKey,
      endDate: endKey,
      today: todayKey,
      ...rest,
    };
  }

  async remove(id: string): Promise<void> {
    const sprint = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
    });
    if (sprint.status !== 'PLANNED')
      throw new ConflictException(
        'Chỉ xoá được sprint ở trạng thái Kế hoạch (việc trong đó về backlog)',
      );
    // Tasks return to the backlog through ON DELETE SET NULL.
    await this.prisma.db.sprint.delete({ where: { id } });
  }
}

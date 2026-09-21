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
  GoalResult,
  ReviewItemDto,
  SprintDto,
  SprintReviewDto,
  UpdateReviewInput,
  UpdateSprintInput,
} from '@pmtool/shared-types';
import {
  buildItems,
  byPerson,
  ReviewTask,
  summarize,
  velocityBefore,
} from './review-math';
import { PrismaService } from '../../prisma/prisma.service';
import { totals } from './sprint-load';
import { vnDateKey } from '../gamification/streak-date.util';
import { buildBurndown } from './burndown-math';

const TASK_LOAD = {
  status: true,
  storyPoints: true,
  estimateHours: true,
} as const;

/** What the review needs from each task: size, status, when it joined, and who is accountable. */
const REVIEW_TASK_SELECT = {
  id: true,
  humanKey: true,
  title: true,
  status: true,
  storyPoints: true,
  estimateHours: true,
  sprintAddedAt: true,
  assignees: {
    where: { role: 'PRIMARY' as const },
    select: {
      user: { select: { id: true, fullName: true, mascotCharacter: true } },
    },
  },
} as const;

type ReviewTaskRow = Prisma.TaskGetPayload<{
  select: typeof REVIEW_TASK_SELECT;
}>;

const toReviewTask = (t: ReviewTaskRow): ReviewTask => ({
  id: t.id,
  humanKey: t.humanKey,
  title: t.title,
  status: t.status,
  storyPoints: t.storyPoints,
  estimateHours: t.estimateHours,
  sprintAddedAt: t.sprintAddedAt,
  assignee: t.assignees[0]
    ? {
        id: t.assignees[0].user.id,
        name: t.assignees[0].user.fullName,
        character: t.assignees[0].user.mascotCharacter,
      }
    : null,
});

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
      include: { tasks: { select: REVIEW_TASK_SELECT } },
    });
    if (sprint.status !== 'ACTIVE')
      throw new ConflictException('Chỉ sprint đang chạy mới đóng được');

    const target = input.moveUnfinishedTo ?? null;
    let targetName: string | null = null;
    if (target) {
      const t = await this.prisma.db.sprint.findUnique({
        where: { id: target },
      });
      targetName = t?.name ?? null;
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
    // What the sprint held when it closed, frozen: the unfinished work is about to move away.
    const items: ReviewItemDto[] = buildItems(
      sprint.tasks.map(toReviewTask),
      project.estimationUnit,
      sprint.startedAt,
    ).map((i) => ({
      ...i,
      carriedTo:
        i.status === 'DONE'
          ? null
          : target
            ? { kind: 'sprint' as const, name: targetName }
            : { kind: 'backlog' as const, name: null },
    }));
    await this.prisma.db.$transaction([
      this.prisma.db.task.updateMany({
        where: { id: { in: unfinished } },
        data: { sprintId: target, sprintAddedAt: target ? new Date() : null },
      }),
      this.prisma.db.sprint.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          completedLoad,
          outcome: { items },
        },
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

  /**
   * The sprint review: what was promised, delivered and left over, who did what, and how this sprint compares with the
   * ones before. A running sprint gets a live preview to prepare with; a closed one reads the outcome frozen at closing.
   */
  async review(project: Project, id: string): Promise<SprintReviewDto> {
    const sprint = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
      include: { tasks: { select: REVIEW_TASK_SELECT } },
    });
    if (sprint.status === 'PLANNED') {
      throw new ConflictException('Sprint chưa bắt đầu nên chưa có review');
    }
    const unit = project.estimationUnit;
    const isPreview = sprint.status === 'ACTIVE';
    const stored = (sprint.outcome as { items?: ReviewItemDto[] } | null)
      ?.items;
    const detailsAvailable = isPreview || Array.isArray(stored);
    const items: ReviewItemDto[] = isPreview
      ? buildItems(sprint.tasks.map(toReviewTask), unit, sprint.startedAt)
      : (stored ??
        buildItems(sprint.tasks.map(toReviewTask), unit, sprint.startedAt));

    let summary = summarize(items, sprint.committedLoad);
    if (!detailsAvailable) {
      // Closed before reviews existed: only the two totals recorded at closing are known.
      const planned = sprint.committedLoad ?? summary.finalPlanned;
      const completed = sprint.completedLoad ?? summary.completed;
      summary = {
        ...summary,
        finalPlanned: planned,
        completed,
        unfinished: Math.max(0, Math.round((planned - completed) * 10) / 10),
        completionPct:
          planned === 0 ? 0 : Math.round((completed / planned) * 100),
        added: 0,
        addedCount: 0,
      };
    }

    const closed = await this.prisma.db.sprint.findMany({
      where: { projectId: project.id, status: 'CLOSED' },
      orderBy: { closedAt: 'asc' },
      select: {
        id: true,
        name: true,
        committedLoad: true,
        completedLoad: true,
      },
    });
    const closedRows = closed.map((c) => ({
      id: c.id,
      name: c.name,
      committed: c.committedLoad ?? 0,
      completed: c.completedLoad ?? 0,
    }));
    const recent = closedRows.slice(-5);
    const history = [
      ...(recent.some((r) => r.id === id) ? recent : recent.slice(-4)).map(
        (r) => ({ ...r, isCurrent: r.id === id }),
      ),
      ...(isPreview
        ? [
            {
              id,
              name: sprint.name,
              committed: sprint.committedLoad ?? 0,
              completed: summary.completed,
              isCurrent: true,
            },
          ]
        : []),
    ];

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        status: sprint.status,
        startDate: vnDateKey(sprint.startDate),
        endDate: vnDateKey(sprint.endDate),
        closedAt: sprint.closedAt?.toISOString() ?? null,
      },
      unit,
      isPreview,
      detailsAvailable,
      summary,
      delivered: items.filter((i) => i.status === 'DONE'),
      unfinished: items.filter((i) => i.status !== 'DONE'),
      people: detailsAvailable ? byPerson(items) : [],
      history,
      velocityAvg: velocityBefore(closedRows, isPreview ? null : id),
      goalResult: (sprint.goalResult as GoalResult | null) ?? null,
      reviewNotes: sprint.reviewNotes,
    };
  }

  /** The team's conclusions from the review meeting: a verdict on the sprint goal and free-form notes. */
  async updateReview(
    project: Project,
    id: string,
    input: UpdateReviewInput,
  ): Promise<SprintReviewDto> {
    const sprint = await this.prisma.db.sprint.findUniqueOrThrow({
      where: { id },
    });
    if (sprint.status === 'PLANNED') {
      throw new ConflictException('Sprint chưa bắt đầu nên chưa có review');
    }
    await this.prisma.db.sprint.update({
      where: { id },
      data: {
        reviewNotes:
          input.reviewNotes === undefined
            ? undefined
            : input.reviewNotes?.trim() || null,
        goalResult: input.goalResult,
      },
    });
    return this.review(project, id);
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

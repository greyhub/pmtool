import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import {
  DailyReportDto,
  DailySnapshotDto,
  ReportTaskRefDto,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { totals } from '../sprints/sprint-load';
import { vnDateKey, vnDayRangeUtc } from '../gamification/streak-date.util';
import {
  addDaysKey,
  diffSnapshots,
  isDateKey,
  isWorthReporting,
  reportNotificationDetail,
} from './report-math';

const OPEN_RISK_STATUSES = ['IDENTIFIED', 'ANALYZING', 'MITIGATING'] as const;
const TREND_DAYS = 14;
const LIST_TAKE = 20;

const dateOf = (key: string) => new Date(`${key}T00:00:00Z`);

type SnapshotRow = Prisma.ProjectDailySnapshotGetPayload<object>;

function toDto(row: SnapshotRow): DailySnapshotDto {
  return {
    date: row.date.toISOString().slice(0, 10),
    tasksTotal: row.tasksTotal,
    todo: row.todo,
    inProgress: row.inProgress,
    inReview: row.inReview,
    done: row.done,
    blocked: row.blocked,
    overdue: row.overdue,
    progressPct: row.progressPct,
    createdCount: row.createdCount,
    completedCount: row.completedCount,
    openRisks: row.openRisks,
    openIssues: row.openIssues,
    deliverablesTotal: row.deliverablesTotal,
    deliverablesAccepted: row.deliverablesAccepted,
    milestonesTotal: row.milestonesTotal,
    milestonesDone: row.milestonesDone,
    sprintPlanned: row.sprintPlanned,
    sprintDone: row.sprintDone,
    activityCount: row.activityCount,
    activeUsers: row.activeUsers,
  };
}

const toRef = (t: {
  id: string;
  humanKey: string;
  title: string;
  status: ReportTaskRefDto['status'];
  dueDate: Date | null;
}): ReportTaskRefDto => ({
  id: t.id,
  humanKey: t.humanKey,
  title: t.title,
  status: t.status,
  dueDate: t.dueDate?.toISOString() ?? null,
});

/**
 * Daily project reports. A snapshot is the state at the end of one Vietnam calendar day; today's is
 * recomputed on demand and fixed by the nightly job, so any day can be compared with an earlier one.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Measures the project now, attributing "created/completed/activity" to the given day. */
  async measure(project: Project, dateKey: string) {
    const db = this.prisma.db;
    const { start, end } = vnDayRangeUtc(dateKey);
    const where = { projectId: project.id };
    const [
      byStatus,
      overdue,
      undonePct,
      created,
      completed,
      openRisks,
      openIssues,
      deliverablesTotal,
      deliverablesAccepted,
      milestonesTotal,
      milestonesDone,
      activeSprint,
      activity,
    ] = await Promise.all([
      db.task.groupBy({ by: ['status'], where, _count: true }),
      db.task.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { not: 'DONE' },
        },
      }),
      db.task.aggregate({
        where: { ...where, status: { not: 'DONE' } },
        _sum: { percentComplete: true },
      }),
      db.task.count({
        where: { ...where, createdAt: { gte: start, lt: end } },
      }),
      db.task.count({
        where: { ...where, completedAt: { gte: start, lt: end } },
      }),
      db.riskIssue.count({
        where: {
          ...where,
          type: 'RISK',
          status: { in: [...OPEN_RISK_STATUSES] },
        },
      }),
      db.riskIssue.count({
        where: {
          ...where,
          type: 'ISSUE',
          status: { in: [...OPEN_RISK_STATUSES] },
        },
      }),
      db.deliverable.count({ where }),
      db.deliverable.count({ where: { ...where, status: 'ACCEPTED' } }),
      db.task.count({ where: { ...where, isMilestone: true } }),
      db.task.count({ where: { ...where, isMilestone: true, status: 'DONE' } }),
      db.sprint.findFirst({
        where: { ...where, status: 'ACTIVE' },
        include: {
          tasks: {
            select: { status: true, storyPoints: true, estimateHours: true },
          },
        },
      }),
      db.activityLog.groupBy({
        by: ['actorId'],
        where: { projectId: project.id, createdAt: { gte: start, lt: end } },
        _count: true,
      }),
    ]);

    const count = (s: string) =>
      byStatus.find((g) => g.status === s)?._count ?? 0;
    const tasksTotal = byStatus.reduce((n, g) => n + g._count, 0);
    const done = count('DONE');
    const progressPct =
      tasksTotal === 0
        ? 0
        : Math.round(
            ((done * 100 + (undonePct._sum.percentComplete ?? 0)) /
              tasksTotal) *
              10,
          ) / 10;
    const sprint = activeSprint
      ? totals(activeSprint.tasks, project.estimationUnit)
      : null;

    return {
      tasksTotal,
      todo: count('TODO'),
      inProgress: count('IN_PROGRESS'),
      inReview: count('IN_REVIEW'),
      done,
      blocked: count('BLOCKED'),
      overdue,
      progressPct,
      createdCount: created,
      completedCount: completed,
      openRisks,
      openIssues,
      deliverablesTotal,
      deliverablesAccepted,
      milestonesTotal,
      milestonesDone,
      sprintPlanned: sprint?.plannedLoad ?? null,
      sprintDone: sprint?.doneLoad ?? null,
      activityCount: activity.reduce((n, a) => n + a._count, 0),
      activeUsers: activity.length,
    };
  }

  /** Computes and stores (or refreshes) the snapshot of one day. */
  async snapshot(project: Project, dateKey: string): Promise<SnapshotRow> {
    const data = await this.measure(project, dateKey);
    const generatedAt = new Date();
    return this.prisma.db.projectDailySnapshot.upsert({
      where: {
        projectId_date: { projectId: project.id, date: dateOf(dateKey) },
      },
      create: {
        organizationId: project.organizationId,
        projectId: project.id,
        date: dateOf(dateKey),
        generatedAt,
        ...data,
      },
      update: { generatedAt, ...data },
    });
  }

  private async stored(projectId: string, dateKey: string) {
    const row = await this.prisma.db.projectDailySnapshot.findUnique({
      where: { projectId_date: { projectId, date: dateOf(dateKey) } },
    });
    return row ? toDto(row) : null;
  }

  async dailyReport(
    project: Project,
    dateKey?: string,
    compareTo?: string,
  ): Promise<DailyReportDto> {
    const today = vnDateKey();
    const date = dateKey ?? today;
    if (!isDateKey(date)) throw new BadRequestException('Ngày không hợp lệ');
    if (date > today)
      throw new BadRequestException('Chưa có báo cáo cho ngày trong tương lai');
    const comparedTo = compareTo ?? addDaysKey(date, -1);
    if (!isDateKey(comparedTo))
      throw new BadRequestException('Ngày so sánh không hợp lệ');
    if (comparedTo >= date) {
      throw new BadRequestException('Ngày so sánh phải trước ngày báo cáo');
    }

    const isLive = date === today;
    const current = isLive
      ? toDto(await this.snapshot(project, date))
      : await this.stored(project.id, date);
    const previous = await this.stored(project.id, comparedTo);

    const trendRows = await this.prisma.db.projectDailySnapshot.findMany({
      where: {
        projectId: project.id,
        date: { gt: dateOf(addDaysKey(date, -TREND_DAYS)), lte: dateOf(date) },
      },
      orderBy: { date: 'asc' },
    });

    const { start, end } = vnDayRangeUtc(date);
    const select = {
      id: true,
      humanKey: true,
      title: true,
      status: true,
      dueDate: true,
    } as const;
    const [completed, dueNotDone, blocked] = await Promise.all([
      this.prisma.db.task.findMany({
        where: { projectId: project.id, completedAt: { gte: start, lt: end } },
        select,
        orderBy: { completedAt: 'asc' },
        take: LIST_TAKE,
      }),
      this.prisma.db.task.findMany({
        where: {
          projectId: project.id,
          dueDate: { gte: start, lt: end },
          status: { not: 'DONE' },
        },
        select,
        orderBy: { dueDate: 'asc' },
        take: LIST_TAKE,
      }),
      isLive
        ? this.prisma.db.task.findMany({
            where: { projectId: project.id, status: 'BLOCKED' },
            select,
            take: LIST_TAKE,
          })
        : Promise.resolve([]),
    ]);

    return {
      date,
      isLive,
      current,
      comparedTo,
      previous,
      deltas: diffSnapshots(current, previous),
      trend: trendRows.map(toDto),
      highlights: {
        completed: completed.map(toRef),
        dueNotDone: dueNotDone.map(toRef),
        blocked: blocked.map(toRef),
      },
    };
  }

  /** Nightly: fix today's snapshot for every project that is still in play. */
  async snapshotAll(now: Date = new Date()): Promise<number> {
    const dateKey = vnDateKey(now);
    const projects = await this.prisma.db.project.findMany({
      where: {
        status: { not: 'ARCHIVED' },
        organization: { status: 'ACTIVE' },
      },
    });
    let n = 0;
    for (const project of projects) {
      try {
        await this.snapshot(project, dateKey);
        n += 1;
      } catch (err) {
        this.logger.warn(
          `Snapshot failed for ${project.key}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Daily snapshot ${dateKey}: ${n}/${projects.length} projects`,
    );
    return n;
  }

  /** Who should hear about a project's day: owners/admins and project managers who can see it. */
  private async managersOf(project: Project): Promise<string[]> {
    const [orgManagers, overrides] = await Promise.all([
      this.prisma.db.membership.findMany({
        where: {
          organizationId: project.organizationId,
          role: {
            in: project.isPrivate
              ? ['OWNER', 'ADMIN']
              : ['OWNER', 'ADMIN', 'PM'],
          },
        },
        select: { userId: true, role: true },
      }),
      this.prisma.db.projectMember.findMany({
        where: { projectId: project.id },
        select: { userId: true, role: true },
      }),
    ]);
    const lowered = new Set(
      overrides
        .filter((o) => !['OWNER', 'ADMIN', 'PM'].includes(o.role))
        .map((o) => o.userId),
    );
    const ids = new Set<string>();
    for (const m of orgManagers) {
      // A project-level role below PM overrides an org-level PM (never an owner/admin).
      if (m.role === 'PM' && lowered.has(m.userId)) continue;
      ids.add(m.userId);
    }
    for (const o of overrides) {
      if (['OWNER', 'ADMIN', 'PM'].includes(o.role)) ids.add(o.userId);
    }
    return [...ids];
  }

  /**
   * Morning: tell managers how yesterday went, once per project-day. Safe to call repeatedly — a snapshot is
   * marked when its summary goes out — so it also catches up after downtime.
   */
  async notifyPending(now: Date = new Date()): Promise<number> {
    const today = vnDateKey(now);
    const pending = await this.prisma.db.projectDailySnapshot.findMany({
      where: {
        notifiedAt: null,
        date: { lt: dateOf(today), gte: dateOf(addDaysKey(today, -2)) },
        project: { status: { not: 'ARCHIVED' } },
      },
      include: { project: true },
    });
    let sent = 0;
    for (const row of pending) {
      const dateKey = row.date.toISOString().slice(0, 10);
      const current = toDto(row);
      const previous = await this.stored(
        row.projectId,
        addDaysKey(dateKey, -1),
      );
      if (isWorthReporting(current, previous)) {
        await this.notifications.notify({
          organizationId: row.organizationId,
          userIds: await this.managersOf(row.project),
          type: 'DAILY_REPORT',
          entityKind: 'report',
          entityId: dateKey,
          projectKey: row.project.key,
          entityTitle: row.project.name,
          detail: reportNotificationDetail(current, previous),
        });
        sent += 1;
      }
      await this.prisma.db.projectDailySnapshot.update({
        where: { id: row.id },
        data: { notifiedAt: new Date() },
      });
    }
    return sent;
  }
}

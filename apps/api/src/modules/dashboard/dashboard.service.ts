import { Injectable } from '@nestjs/common';
import {
  OrgDashboardDto,
  ProjectDashboardDto,
  PROJECT_STATUSES,
  TASK_STATUSES,
  TaskSummaryDto,
} from '@pmtool/shared-types';
import { Task } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const OPEN_RISK_STATUSES = ['IDENTIFIED', 'ANALYZING', 'MITIGATING'] as const;
const OVERDUE_TAKE = 10;

function toTaskSummary(task: Task): TaskSummaryDto {
  return {
    id: task.id,
    humanKey: task.humanKey,
    title: task.title,
    projectId: task.projectId,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
  };
}

function zeroCounts<T extends readonly string[]>(
  keys: T,
): Record<T[number], number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<
    T[number],
    number
  >;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async orgDashboard(organizationId: string): Promise<OrgDashboardDto> {
    const [
      totalProjects,
      projectGroups,
      taskGroups,
      overdueTasks,
      openRiskCount,
    ] = await Promise.all([
      this.prisma.db.project.count({ where: { organizationId } }),
      this.prisma.db.project.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.db.task.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      this.prisma.db.task.findMany({
        where: {
          organizationId,
          dueDate: { lt: new Date() },
          status: { notIn: ['DONE'] },
        },
        orderBy: { dueDate: 'asc' },
        take: OVERDUE_TAKE,
      }),
      this.prisma.db.riskIssue.count({
        where: { organizationId, status: { in: [...OPEN_RISK_STATUSES] } },
      }),
    ]);

    const projectCounts = zeroCounts(PROJECT_STATUSES);
    for (const g of projectGroups) projectCounts[g.status] = g._count;

    const taskCounts = zeroCounts(TASK_STATUSES);
    for (const g of taskGroups) taskCounts[g.status] = g._count;

    return {
      totalProjects,
      projectCounts,
      taskCounts,
      overdueTasks: overdueTasks.map(toTaskSummary),
      openRiskCount,
    };
  }

  async projectDashboard(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectDashboardDto> {
    const [taskGroups, overdueTasks, openRiskCount, openIssueCount] =
      await Promise.all([
        this.prisma.db.task.groupBy({
          by: ['status'],
          where: { organizationId, projectId },
          _count: true,
        }),
        this.prisma.db.task.findMany({
          where: {
            organizationId,
            projectId,
            dueDate: { lt: new Date() },
            status: { notIn: ['DONE'] },
          },
          orderBy: { dueDate: 'asc' },
          take: OVERDUE_TAKE,
        }),
        this.prisma.db.riskIssue.count({
          where: {
            organizationId,
            projectId,
            type: 'RISK',
            status: { in: [...OPEN_RISK_STATUSES] },
          },
        }),
        this.prisma.db.riskIssue.count({
          where: {
            organizationId,
            projectId,
            type: 'ISSUE',
            status: { in: [...OPEN_RISK_STATUSES] },
          },
        }),
      ]);

    const taskCounts = zeroCounts(TASK_STATUSES);
    for (const g of taskGroups) taskCounts[g.status] = g._count;
    const totalTasks = Object.values(taskCounts).reduce((sum, n) => sum + n, 0);
    const completionPercent =
      totalTasks === 0 ? 0 : Math.round((taskCounts.DONE / totalTasks) * 100);

    return {
      taskCounts,
      totalTasks,
      completionPercent,
      overdueTasks: overdueTasks.map(toTaskSummary),
      openRiskCount,
      openIssueCount,
    };
  }
}

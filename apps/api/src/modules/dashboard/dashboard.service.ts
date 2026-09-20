import { Injectable } from '@nestjs/common';
import {
  OnboardingDto,
  ONBOARDING_STEP_KEYS,
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

  /** Which "getting started" steps this organization has already done. */
  async onboarding(organizationId: string): Promise<OnboardingDto> {
    const db = this.prisma.db;
    const [
      firstProject,
      tasks,
      members,
      pendingInvites,
      scopes,
      structured,
      deliverables,
    ] = await Promise.all([
      db.project.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
        select: { key: true },
      }),
      db.task.count({ where: { organizationId } }),
      db.membership.count({ where: { organizationId } }),
      db.membershipInvite.count({
        where: { organizationId, acceptedAt: null },
      }),
      db.projectScope.count({ where: { organizationId } }),
      // Any task given a WBS level above "activity" means the team has started structuring the work.
      db.task.count({
        where: { organizationId, nodeType: { not: 'ACTIVITY' } },
      }),
      db.deliverable.count({ where: { organizationId } }),
    ]);
    const done: Record<(typeof ONBOARDING_STEP_KEYS)[number], boolean> = {
      createProject: firstProject !== null,
      addTasks: tasks >= 5,
      inviteTeammate: members >= 2 || pendingInvites > 0,
      defineScope: scopes > 0 || structured > 0,
      addDeliverable: deliverables > 0,
    };
    const steps = ONBOARDING_STEP_KEYS.map((key) => ({ key, done: done[key] }));
    return {
      steps,
      completed: steps.every((s) => s.done),
      projectKey: firstProject?.key ?? null,
    };
  }

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

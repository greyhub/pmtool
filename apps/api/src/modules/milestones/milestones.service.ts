import { Injectable } from '@nestjs/common';
import { MilestoneDto } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Milestones are just Tasks with `isMilestone` (so they keep their
 * assignees, dependencies, comments and Gantt diamond); this only adds the
 * roll-up of their linked deliverables.
 */
@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    projectId: string,
  ): Promise<MilestoneDto[]> {
    const tasks = await this.prisma.db.task.findMany({
      where: { organizationId, projectId, isMilestone: true },
      include: {
        assignees: {
          where: { role: 'PRIMARY' },
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    if (tasks.length === 0) return [];

    const deliverables = await this.prisma.db.deliverable.findMany({
      where: {
        organizationId,
        projectId,
        taskId: { in: tasks.map((t) => t.id) },
      },
      select: { taskId: true, status: true },
    });
    const now = Date.now();

    return tasks.map((t) => {
      const mine = deliverables.filter((d) => d.taskId === t.id);
      const primary = t.assignees[0]?.user ?? null;
      return {
        id: t.id,
        humanKey: t.humanKey,
        title: t.title,
        dueDate: t.dueDate?.toISOString() ?? null,
        status: t.status,
        percentComplete: t.percentComplete,
        assignee: primary
          ? {
              id: primary.id,
              fullName: primary.fullName,
              avatarUrl: primary.avatarUrl,
            }
          : null,
        deliverablesTotal: mine.length,
        deliverablesAccepted: mine.filter((d) => d.status === 'ACCEPTED')
          .length,
        isOverdue:
          !!t.dueDate && t.dueDate.getTime() < now && t.status !== 'DONE',
      };
    });
  }
}

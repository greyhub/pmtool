import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MyTaskDto } from '@pmtool/shared-types';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

/** The caller's own work across every project of the organization. */
@ApiTags('tasks')
@Controller({ path: 'organizations/:orgSlug/my-tasks', version: '1' })
@UseGuards(OrgMembershipGuard)
export class MyTasksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeDone') includeDone?: string,
  ): Promise<{ data: MyTaskDto[] }> {
    const rows = await this.prisma.db.taskAssignee.findMany({
      where: {
        organizationId: ctx.organization.id,
        userId: user.id,
        ...(includeDone === 'true'
          ? {}
          : { task: { status: { not: 'DONE' } } }),
      },
      include: {
        task: { include: { project: { select: { key: true, name: true } } } },
      },
      take: 500,
    });
    const data: MyTaskDto[] = rows
      .map((a) => ({
        id: a.task.id,
        humanKey: a.task.humanKey,
        title: a.task.title,
        status: a.task.status,
        priority: a.task.priority,
        nodeType: a.task.nodeType,
        isMilestone: a.task.isMilestone,
        dueDate: a.task.dueDate?.toISOString() ?? null,
        percentComplete: a.task.percentComplete,
        role: a.role,
        projectKey: a.task.project.key,
        projectName: a.task.project.name,
      }))
      // Nearest deadline first; undated work last.
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    return { data };
  }
}

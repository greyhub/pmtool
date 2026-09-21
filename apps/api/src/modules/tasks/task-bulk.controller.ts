import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  bulkNodeTypeSchema,
  BulkNodeTypeInput,
  BulkNodeTypeResultDto,
  WbsNodeType,
} from '@pmtool/shared-types';
import { addActivityMetadata } from '../../common/context/request-context';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ProjectRolesGuard } from '../../common/guards/project-roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { countLevels, levelsByDepth, planBulk } from './wbs-bulk';

const CAN_EDIT_TASKS = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

/** Re-level many tasks in one step — for tidying older data into the PMBOK structure. */
@ApiTags('tasks')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/task-bulk',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard, ProjectRolesGuard)
@Roles(...CAN_EDIT_TASKS)
export class TaskBulkController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('node-type')
  @HttpCode(HttpStatus.OK)
  @LogActivity('Task', 'bulk-retyped', 'projectKey')
  async retype(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Body(new ZodValidationPipe(bulkNodeTypeSchema)) body: BulkNodeTypeInput,
  ): Promise<{ data: BulkNodeTypeResultDto }> {
    const tasks = await this.prisma.db.task.findMany({
      where: { organizationId: ctx.organization.id, projectId: project.id },
      select: { id: true, humanKey: true, parentTaskId: true, nodeType: true },
    });

    let wanted = new Map<string, WbsNodeType>();
    const errors: { taskId: string; humanKey: string; message: string }[] = [];
    if (body.byDepth) {
      const { levels, errors: depthErrors } = levelsByDepth(tasks);
      wanted = levels;
      errors.push(...depthErrors);
    } else {
      const known = new Set(tasks.map((t) => t.id));
      for (const id of body.taskIds ?? []) {
        if (known.has(id)) wanted.set(id, body.nodeType!);
        else
          errors.push({
            taskId: id,
            humanKey: '',
            message: 'Công việc không thuộc dự án này',
          });
      }
    }

    const plan = planBulk(tasks, wanted);
    errors.push(...plan.errors);
    const counts = countLevels(plan.final);
    const result: BulkNodeTypeResultDto = {
      committed: false,
      changed: plan.changes.size,
      counts,
      errors,
    };
    if (body.dryRun || errors.length > 0 || plan.changes.size === 0)
      return { data: result };

    // Group by target level: one UPDATE per level, all in one transaction.
    const byType = new Map<WbsNodeType, string[]>();
    for (const [id, type] of plan.changes)
      byType.set(type, [...(byType.get(type) ?? []), id]);
    await this.prisma.db.$transaction(
      Array.from(byType, ([nodeType, ids]) =>
        this.prisma.db.task.updateMany({
          where: { id: { in: ids }, projectId: project.id },
          data: { nodeType },
        }),
      ),
    );
    addActivityMetadata({
      changed: plan.changes.size,
      mode: body.byDepth ? 'byDepth' : body.nodeType,
    });
    return { data: { ...result, committed: true } };
  }
}

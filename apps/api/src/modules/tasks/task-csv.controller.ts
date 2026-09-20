import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  importTasksCsvSchema,
  ImportTasksCsvInput,
} from '@pmtool/shared-types';
import type { Response } from 'express';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { addActivityMetadata } from '../../common/context/request-context';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ProjectRolesGuard } from '../../common/guards/project-roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ImportOutcome, TaskCsvService } from './task-csv.service';

const CAN_EDIT_TASKS = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('tasks')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/task-csv',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class TaskCsvController {
  constructor(private readonly csv: TaskCsvService) {}

  @Get('export')
  async export(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Res() res: Response,
  ): Promise<void> {
    const body = await this.csv.exportCsv(ctx.organization.id, project.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${project.key}-wbs-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(body);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectRolesGuard, RateLimitGuard)
  @Roles(...CAN_EDIT_TASKS)
  @RateLimit({ name: 'task-import', limit: 30, windowSec: 3600, by: 'user' })
  @LogActivity('Task', 'imported', 'projectKey')
  async import(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(importTasksCsvSchema))
    body: ImportTasksCsvInput,
  ): Promise<{ data: ImportOutcome }> {
    const outcome = await this.csv.importCsv(
      ctx.organization.id,
      project.id,
      user.id,
      body.csv,
      body.dryRun ?? false,
    );
    if (outcome.committed) addActivityMetadata({ imported: outcome.valid });
    return { data: outcome };
  }
}

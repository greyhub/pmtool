import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  ParseNlTasksInput,
  parseNlTasksInputSchema,
  ParseNlTasksResponseDto,
  SuggestSubtasksResponseDto,
  SummarizeTaskResponseDto,
} from '@pmtool/shared-types';
import { AiService } from './ai.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ProjectEntityGuard } from '../../common/guards/project-entity.guard';
import { ProjectEntity } from '../../common/decorators/project-entity.decorator';
import { ProjectRolesGuard } from '../../common/guards/project-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { AiQuotaService } from './ai-quota.service';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';

// Matches task-creation permission, since accepting an AI suggestion results
// in a task being created — redeclared locally rather than imported, same
// as TasksModule/RisksModule each keep their own copy of this tuple.
const CAN_USE_AI = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('ai')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey',
  version: '1',
})
@UseGuards(
  EmailVerifiedGuard,
  OrgMembershipGuard,
  ProjectGuard,
  ProjectEntityGuard,
  ProjectRolesGuard,
  RateLimitGuard,
)
@Roles(...CAN_USE_AI)
@RateLimit({ name: 'ai', limit: 20, windowSec: 60, by: 'user' })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiQuota: AiQuotaService,
  ) {}

  @Post('tasks/:taskId/summarize')
  @ProjectEntity('task', 'taskId')
  async summarize(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<{ data: SummarizeTaskResponseDto }> {
    await this.aiQuota.consume(ctx.organization.id);
    const data = await this.aiService.summarizeTask(
      ctx.organization.id,
      taskId,
    );
    return { data };
  }

  @Post('tasks/:taskId/suggest-subtasks')
  @ProjectEntity('task', 'taskId')
  async suggestSubtasks(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<{ data: SuggestSubtasksResponseDto }> {
    await this.aiQuota.consume(ctx.organization.id);
    const data = await this.aiService.suggestSubtasks(
      ctx.organization.id,
      taskId,
    );
    return { data };
  }

  @Post('tasks/parse-nl')
  async parseNl(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Body(new ZodValidationPipe(parseNlTasksInputSchema))
    body: ParseNlTasksInput,
  ): Promise<{ data: ParseNlTasksResponseDto }> {
    await this.aiQuota.consume(ctx.organization.id);
    const data = await this.aiService.parseNlTasks(project.name, body.text);
    return { data };
  }
}

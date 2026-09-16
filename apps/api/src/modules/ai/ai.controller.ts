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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';

// Matches task-creation permission, since accepting an AI suggestion results
// in a task being created — redeclared locally rather than imported, same
// as TasksModule/RisksModule each keep their own copy of this tuple.
const CAN_USE_AI = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('ai')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard, RolesGuard)
@Roles(...CAN_USE_AI)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tasks/:taskId/summarize')
  async summarize(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<{ data: SummarizeTaskResponseDto }> {
    const data = await this.aiService.summarizeTask(
      ctx.organization.id,
      taskId,
    );
    return { data };
  }

  @Post('tasks/:taskId/suggest-subtasks')
  async suggestSubtasks(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<{ data: SuggestSubtasksResponseDto }> {
    const data = await this.aiService.suggestSubtasks(
      ctx.organization.id,
      taskId,
    );
    return { data };
  }

  @Post('tasks/parse-nl')
  async parseNl(
    @CurrentProject() project: Project,
    @Body(new ZodValidationPipe(parseNlTasksInputSchema))
    body: ParseNlTasksInput,
  ): Promise<{ data: ParseNlTasksResponseDto }> {
    const data = await this.aiService.parseNlTasks(project.name, body.text);
    return { data };
  }
}

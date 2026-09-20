import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  ProjectScopeDto,
  ScopeMapDto,
  UpsertScopeInput,
  upsertScopeSchema,
  UpsertWbsDictionaryInput,
  upsertWbsDictionarySchema,
  WbsDictionaryDto,
} from '@pmtool/shared-types';
import { ScopeService } from './scope.service';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ProjectRolesGuard } from '../../common/guards/project-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';

const CAN_EDIT_SCOPE = ['OWNER', 'ADMIN', 'PM'] as const;
// Same as the charter: the author (PM) proposes, the sponsor side (Owner/Admin) signs off.
const CAN_APPROVE_SCOPE = ['OWNER', 'ADMIN'] as const;
const CAN_EDIT_DICTIONARY = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('scope')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class ScopeController {
  constructor(private readonly scopeService: ScopeService) {}

  @Get('scope')
  async getScope(
    @CurrentProject() project: Project,
  ): Promise<{ data: ProjectScopeDto | null }> {
    return { data: await this.scopeService.getScope(project.id) };
  }

  @Put('scope')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_SCOPE)
  @LogActivity('ProjectScope', 'updated')
  async upsertScope(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(upsertScopeSchema)) body: UpsertScopeInput,
  ): Promise<{ data: ProjectScopeDto }> {
    return {
      data: await this.scopeService.upsertScope(
        ctx.organization.id,
        project.id,
        user.id,
        body,
      ),
    };
  }

  @Post('scope/approve')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_APPROVE_SCOPE)
  @LogActivity('ProjectScope', 'updated')
  async approveScope(
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProjectScopeDto }> {
    return { data: await this.scopeService.approveScope(project.id, user.id) };
  }

  @Get('scope-map')
  async scopeMap(
    @CurrentProject() project: Project,
  ): Promise<{ data: ScopeMapDto }> {
    return { data: await this.scopeService.scopeMap(project.id) };
  }

  @Get('wbs/:taskId/dictionary')
  async getDictionary(
    @CurrentProject() project: Project,
    @Param('taskId') taskId: string,
  ): Promise<{ data: WbsDictionaryDto | null }> {
    return {
      data: await this.scopeService.getDictionary(taskId, project.id),
    };
  }

  @Put('wbs/:taskId/dictionary')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_DICTIONARY)
  @LogActivity('WbsDictionaryEntry', 'updated', 'taskId')
  async upsertDictionary(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(upsertWbsDictionarySchema))
    body: UpsertWbsDictionaryInput,
  ): Promise<{ data: WbsDictionaryDto }> {
    return {
      data: await this.scopeService.upsertDictionary(
        ctx.organization.id,
        project.id,
        taskId,
        user.id,
        body,
      ),
    };
  }
}

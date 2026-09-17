import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  ProjectCharterDto,
  UpsertCharterInput,
  upsertCharterSchema,
} from '@pmtool/shared-types';
import { CharterService } from './charter.service';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
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
import { toProjectCharterDto } from './charter.mapper';

const CAN_EDIT_CHARTER = ['OWNER', 'ADMIN', 'PM'] as const;
const CAN_APPROVE_CHARTER = ['OWNER', 'ADMIN'] as const;

@ApiTags('charter')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/charter',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class CharterController {
  constructor(private readonly charterService: CharterService) {}

  @Get()
  async get(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: ProjectCharterDto | null }> {
    const charter = await this.charterService.getOrNull(
      ctx.organization.id,
      project.id,
    );
    return { data: charter ? toProjectCharterDto(charter) : null };
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_CHARTER)
  @LogActivity('ProjectCharter', 'updated')
  async upsert(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(upsertCharterSchema)) body: UpsertCharterInput,
  ): Promise<{ data: ProjectCharterDto }> {
    const charter = await this.charterService.upsert(
      ctx.organization.id,
      project.id,
      user.id,
      body,
    );
    return { data: toProjectCharterDto(charter) };
  }

  @Post('approve')
  @UseGuards(RolesGuard)
  @Roles(...CAN_APPROVE_CHARTER)
  @LogActivity('ProjectCharter', 'updated')
  async approve(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProjectCharterDto }> {
    const charter = await this.charterService.approve(
      ctx.organization.id,
      project.id,
      user.id,
    );
    return { data: toProjectCharterDto(charter) };
  }
}

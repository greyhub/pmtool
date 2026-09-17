import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  CreateStakeholderInput,
  createStakeholderSchema,
  StakeholderDto,
  UpdateStakeholderInput,
  updateStakeholderSchema,
} from '@pmtool/shared-types';
import { StakeholdersService } from './stakeholders.service';
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
import { toStakeholderDto } from './stakeholder.mapper';

const CAN_EDIT_STAKEHOLDERS = ['OWNER', 'ADMIN', 'PM'] as const;

@ApiTags('stakeholders')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/stakeholders',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class StakeholdersController {
  constructor(private readonly stakeholdersService: StakeholdersService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: StakeholderDto[] }> {
    const stakeholders = await this.stakeholdersService.list(
      ctx.organization.id,
      project.id,
    );
    return { data: stakeholders.map(toStakeholderDto) };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_STAKEHOLDERS)
  @LogActivity('Stakeholder', 'created')
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createStakeholderSchema))
    body: CreateStakeholderInput,
  ): Promise<{ data: StakeholderDto }> {
    const stakeholder = await this.stakeholdersService.create(
      ctx.organization.id,
      project.id,
      user.id,
      body,
    );
    return { data: toStakeholderDto(stakeholder) };
  }

  @Patch(':stakeholderId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_STAKEHOLDERS)
  @LogActivity('Stakeholder', 'updated')
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('stakeholderId') stakeholderId: string,
    @Body(new ZodValidationPipe(updateStakeholderSchema))
    body: UpdateStakeholderInput,
  ): Promise<{ data: StakeholderDto }> {
    const stakeholder = await this.stakeholdersService.update(
      ctx.organization.id,
      stakeholderId,
      body,
    );
    return { data: toStakeholderDto(stakeholder) };
  }

  @Delete(':stakeholderId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_STAKEHOLDERS)
  @LogActivity('Stakeholder', 'deleted', 'stakeholderId')
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('stakeholderId') stakeholderId: string,
  ): Promise<void> {
    await this.stakeholdersService.remove(ctx.organization.id, stakeholderId);
  }
}

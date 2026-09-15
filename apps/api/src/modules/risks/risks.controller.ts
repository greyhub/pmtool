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
  CreateRiskIssueInput,
  createRiskIssueSchema,
  RiskIssueDto,
  UpdateRiskIssueInput,
  updateRiskIssueSchema,
} from '@pmtool/shared-types';
import { RisksService } from './risks.service';
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
import { toRiskIssueDto } from './risk-issue.mapper';

const CAN_EDIT_RISKS = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('risks')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/risks',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: RiskIssueDto[] }> {
    const risks = await this.risksService.list(ctx.organization.id, project.id);
    return { data: risks.map(toRiskIssueDto) };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_RISKS)
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRiskIssueSchema))
    body: CreateRiskIssueInput,
  ): Promise<{ data: RiskIssueDto }> {
    const risk = await this.risksService.create(
      ctx.organization.id,
      project.id,
      user.id,
      body,
    );
    return { data: toRiskIssueDto(risk) };
  }

  @Patch(':riskId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_RISKS)
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('riskId') riskId: string,
    @Body(new ZodValidationPipe(updateRiskIssueSchema))
    body: UpdateRiskIssueInput,
  ): Promise<{ data: RiskIssueDto }> {
    const risk = await this.risksService.update(
      ctx.organization.id,
      riskId,
      body,
    );
    return { data: toRiskIssueDto(risk) };
  }

  @Delete(':riskId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_RISKS)
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('riskId') riskId: string,
  ): Promise<void> {
    await this.risksService.remove(ctx.organization.id, riskId);
  }
}

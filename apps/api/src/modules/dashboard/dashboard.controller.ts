import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import { OrgDashboardDto, ProjectDashboardDto } from '@pmtool/shared-types';
import { DashboardService } from './dashboard.service';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';

@ApiTags('dashboard')
@Controller({ path: 'organizations/:orgSlug/dashboard', version: '1' })
@UseGuards(OrgMembershipGuard)
export class OrgDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async get(
    @CurrentOrg() ctx: CurrentOrgContext,
  ): Promise<{ data: OrgDashboardDto }> {
    const data = await this.dashboardService.orgDashboard(ctx.organization.id);
    return { data };
  }
}

@ApiTags('dashboard')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/dashboard',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class ProjectDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async get(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: ProjectDashboardDto }> {
    const data = await this.dashboardService.projectDashboard(
      ctx.organization.id,
      project.id,
    );
    return { data };
  }
}

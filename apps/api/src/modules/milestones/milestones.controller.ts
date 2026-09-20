import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import { MilestoneDto } from '@pmtool/shared-types';
import { MilestonesService } from './milestones.service';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';

@ApiTags('milestones')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/milestones',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class MilestonesController {
  constructor(private readonly service: MilestonesService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: MilestoneDto[] }> {
    return { data: await this.service.list(ctx.organization.id, project.id) };
  }
}

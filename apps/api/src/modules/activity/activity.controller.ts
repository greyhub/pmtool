import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActivityLogDto } from '@pmtool/shared-types';
import { ActivityService } from './activity.service';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { toActivityLogDto } from './activity-log.mapper';

@ApiTags('activity')
@Controller({ path: 'organizations/:orgSlug/activity', version: '1' })
@UseGuards(OrgMembershipGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
  ): Promise<{ data: ActivityLogDto[] }> {
    const logs = await this.activityService.listForOrg(ctx.organization.id);
    return { data: logs.map(toActivityLogDto) };
  }
}

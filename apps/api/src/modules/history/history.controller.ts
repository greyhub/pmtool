import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  AuditQuery,
  auditQuerySchema,
  HistoryPageDto,
  HistoryQuery,
  historyQuerySchema,
  LoginEventDto,
} from '@pmtool/shared-types';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { HistoryService } from './history.service';
import { PresenceService } from '../presence/presence.service';
import { toLoginEventDto } from '../presence/login-event.mapper';

@ApiTags('history')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/history',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class ProjectHistoryController {
  constructor(private readonly history: HistoryService) {}

  /** Anyone who can see the project can read what changed in it. */
  @Get()
  async list(
    @CurrentProject() project: Project,
    @Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQuery,
  ): Promise<{ data: HistoryPageDto }> {
    return { data: await this.history.forProject(project, query) };
  }
}

@ApiTags('history')
@Controller({ path: 'organizations/:orgSlug/audit', version: '1' })
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AuditController {
  constructor(
    private readonly history: HistoryService,
    private readonly presence: PresenceService,
  ) {}

  /** The organization-wide audit trail (every project, members, settings) for owners and admins. */
  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
  ): Promise<{ data: HistoryPageDto }> {
    const { projectKey, ...rest } = query;
    return {
      data: await this.history.forOrganization(
        ctx.organization.id,
        projectKey,
        rest,
      ),
    };
  }

  /** Every login by every current member of the org — a security view, owners/admins only. */
  @Get('logins')
  async logins(
    @CurrentOrg() ctx: CurrentOrgContext,
  ): Promise<{ data: LoginEventDto[] }> {
    const events = await this.presence.orgLoginHistory(ctx.organization.id);
    return { data: events.map(toLoginEventDto) };
  }
}

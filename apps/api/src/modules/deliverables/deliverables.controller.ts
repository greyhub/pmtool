import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  CreateDeliverableInput,
  createDeliverableSchema,
  DeliverableDto,
  RejectDeliverableInput,
  rejectDeliverableSchema,
  UpdateDeliverableInput,
  updateDeliverableSchema,
} from '@pmtool/shared-types';
import { DeliverablesService } from './deliverables.service';
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
import { toDeliverableDto } from './deliverable.mapper';

const CAN_EDIT_DELIVERABLES = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;
// Sign-off is a PM decision, like approving the charter.
const CAN_REVIEW_DELIVERABLES = ['OWNER', 'ADMIN', 'PM'] as const;
// Deleting removes the sign-off history, so it is a reviewer-level action.
const CAN_DELETE_DELIVERABLES = CAN_REVIEW_DELIVERABLES;

@ApiTags('deliverables')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/deliverables',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class DeliverablesController {
  constructor(private readonly service: DeliverablesService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: DeliverableDto[] }> {
    const rows = await this.service.list(ctx.organization.id, project.id);
    return { data: rows.map(toDeliverableDto) };
  }

  @Post()
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_DELIVERABLES)
  @LogActivity('Deliverable', 'created')
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createDeliverableSchema))
    body: CreateDeliverableInput,
  ): Promise<{ data: DeliverableDto }> {
    const row = await this.service.create(
      ctx.organization.id,
      project.id,
      user.id,
      body,
    );
    return { data: toDeliverableDto(row) };
  }

  @Patch(':deliverableId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_DELIVERABLES)
  @LogActivity('Deliverable', 'updated')
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Param('deliverableId') deliverableId: string,
    @Body(new ZodValidationPipe(updateDeliverableSchema))
    body: UpdateDeliverableInput,
  ): Promise<{ data: DeliverableDto }> {
    const row = await this.service.update(
      ctx.organization.id,
      project.id,
      deliverableId,
      body,
    );
    return { data: toDeliverableDto(row) };
  }

  @Post(':deliverableId/submit')
  @HttpCode(200)
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_DELIVERABLES)
  @LogActivity('Deliverable', 'updated', 'deliverableId')
  async submit(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Param('deliverableId') deliverableId: string,
  ): Promise<{ data: DeliverableDto }> {
    const row = await this.service.submit(
      ctx.organization.id,
      project.id,
      deliverableId,
    );
    return { data: toDeliverableDto(row) };
  }

  @Post(':deliverableId/accept')
  @HttpCode(200)
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_REVIEW_DELIVERABLES)
  @LogActivity('Deliverable', 'updated', 'deliverableId')
  async accept(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Param('deliverableId') deliverableId: string,
  ): Promise<{ data: DeliverableDto }> {
    const row = await this.service.accept(
      ctx.organization.id,
      project.id,
      deliverableId,
      user.id,
    );
    return { data: toDeliverableDto(row) };
  }

  @Post(':deliverableId/reject')
  @HttpCode(200)
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_REVIEW_DELIVERABLES)
  @LogActivity('Deliverable', 'updated', 'deliverableId')
  async reject(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Param('deliverableId') deliverableId: string,
    @Body(new ZodValidationPipe(rejectDeliverableSchema))
    body: RejectDeliverableInput,
  ): Promise<{ data: DeliverableDto }> {
    const row = await this.service.reject(
      ctx.organization.id,
      project.id,
      deliverableId,
      user.id,
      body.reason,
    );
    return { data: toDeliverableDto(row) };
  }

  @Delete(':deliverableId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_DELETE_DELIVERABLES)
  @LogActivity('Deliverable', 'deleted', 'deliverableId')
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Param('deliverableId') deliverableId: string,
  ): Promise<void> {
    await this.service.remove(ctx.organization.id, project.id, deliverableId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  updateReviewSchema,
  UpdateReviewInput,
  SprintReviewDto,
  BurndownDto,
  closeSprintSchema,
  CloseSprintInput,
  createSprintSchema,
  CreateSprintInput,
  SprintDto,
  updateSprintSchema,
  UpdateSprintInput,
} from '@pmtool/shared-types';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { ProjectEntity } from '../../common/decorators/project-entity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectEntityGuard } from '../../common/guards/project-entity.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ProjectRolesGuard } from '../../common/guards/project-roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SprintsService } from './sprints.service';

// Planning the iteration is a management act; the team then moves work in and out through the task itself.
const CAN_MANAGE_SPRINTS = ['OWNER', 'ADMIN', 'PM'] as const;

@ApiTags('sprints')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/sprints',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard, ProjectEntityGuard)
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get()
  async list(
    @CurrentProject() project: Project,
  ): Promise<{ data: SprintDto[] }> {
    return { data: await this.sprints.list(project) };
  }

  @Post()
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_MANAGE_SPRINTS)
  @LogActivity('Sprint', 'created', 'projectKey')
  async create(
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSprintSchema)) body: CreateSprintInput,
  ): Promise<{ data: SprintDto }> {
    return { data: await this.sprints.create(project, user.id, body) };
  }

  @Patch(':sprintId')
  @ProjectEntity('sprint', 'sprintId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_MANAGE_SPRINTS)
  @LogActivity('Sprint', 'updated', 'sprintId')
  async update(
    @CurrentProject() project: Project,
    @Param('sprintId') sprintId: string,
    @Body(new ZodValidationPipe(updateSprintSchema)) body: UpdateSprintInput,
  ): Promise<{ data: SprintDto }> {
    return { data: await this.sprints.update(project, sprintId, body) };
  }

  /** Anyone who can see the project can see how its sprints are going. */
  @Get(':sprintId/burndown')
  @ProjectEntity('sprint', 'sprintId')
  async burndown(
    @CurrentProject() project: Project,
    @Param('sprintId') sprintId: string,
  ): Promise<{ data: BurndownDto }> {
    return { data: await this.sprints.burndown(project, sprintId) };
  }

  /** The sprint review (a live preview while the sprint runs). Anyone who can see the project can read it. */
  @Get(':sprintId/review')
  @ProjectEntity('sprint', 'sprintId')
  async review(
    @CurrentProject() project: Project,
    @Param('sprintId') sprintId: string,
  ): Promise<{ data: SprintReviewDto }> {
    return { data: await this.sprints.review(project, sprintId) };
  }

  /** Managers record the verdict on the sprint goal and the notes from the review meeting. */
  @Put(':sprintId/review')
  @ProjectEntity('sprint', 'sprintId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_MANAGE_SPRINTS)
  @LogActivity('Sprint', 'reviewed', 'sprintId')
  async updateReview(
    @CurrentProject() project: Project,
    @Param('sprintId') sprintId: string,
    @Body(new ZodValidationPipe(updateReviewSchema)) body: UpdateReviewInput,
  ): Promise<{ data: SprintReviewDto }> {
    return { data: await this.sprints.updateReview(project, sprintId, body) };
  }

  @Post(':sprintId/start')
  @HttpCode(HttpStatus.OK)
  @ProjectEntity('sprint', 'sprintId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_MANAGE_SPRINTS)
  @LogActivity('Sprint', 'started', 'sprintId')
  async start(
    @CurrentProject() project: Project,
    @Param('sprintId') sprintId: string,
  ): Promise<{ data: SprintDto }> {
    return { data: await this.sprints.start(project, sprintId) };
  }

  @Post(':sprintId/close')
  @HttpCode(HttpStatus.OK)
  @ProjectEntity('sprint', 'sprintId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_MANAGE_SPRINTS)
  @LogActivity('Sprint', 'closed', 'sprintId')
  async close(
    @CurrentProject() project: Project,
    @Param('sprintId') sprintId: string,
    @Body(new ZodValidationPipe(closeSprintSchema)) body: CloseSprintInput,
  ): Promise<{ data: SprintDto }> {
    return { data: await this.sprints.close(project, sprintId, body) };
  }

  @Delete(':sprintId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ProjectEntity('sprint', 'sprintId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_MANAGE_SPRINTS)
  @LogActivity('Sprint', 'deleted', 'sprintId')
  async remove(@Param('sprintId') sprintId: string): Promise<void> {
    await this.sprints.remove(sprintId);
  }
}

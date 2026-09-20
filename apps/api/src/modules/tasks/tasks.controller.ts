import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  TaskHistoryEntryDto,
  CommentDto,
  CreateCommentInput,
  createCommentSchema,
  CreateTaskInput,
  createTaskSchema,
  MoveTaskInput,
  moveTaskSchema,
  TaskDto,
  UpdateTaskInput,
  updateTaskSchema,
} from '@pmtool/shared-types';
import { TasksService } from './tasks.service';
import { CommentsService } from './comments.service';
import { ActivityService } from '../activity/activity.service';
import { toTaskHistory } from './task-history.mapper';
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
import { toTaskDto } from './task.mapper';
import { toCommentDto } from './comment.mapper';
import { ProjectEntityGuard } from '../../common/guards/project-entity.guard';
import { ProjectEntity } from '../../common/decorators/project-entity.decorator';

const CAN_EDIT_TASKS = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('tasks')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/tasks',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard, ProjectEntityGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly commentsService: CommentsService,
    private readonly activityService: ActivityService,
  ) {}

  @Post()
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_TASKS)
  @LogActivity('Task', 'created')
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
  ): Promise<{ data: TaskDto }> {
    const task = await this.tasksService.create(
      ctx.organization.id,
      project.id,
      user.id,
      body,
    );
    return { data: toTaskDto(task) };
  }

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Query('parentTaskId') parentTaskId?: string,
    @Query('root') root?: string,
  ): Promise<{ data: TaskDto[] }> {
    const parent = root === 'true' ? null : parentTaskId;
    const tasks = await this.tasksService.list(
      ctx.organization.id,
      project.id,
      parent,
    );
    return { data: tasks.map(toTaskDto) };
  }

  @Get(':taskId')
  @ProjectEntity('task', 'taskId')
  async getOne(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<{ data: TaskDto }> {
    const task = await this.tasksService.findByIdOrThrow(
      ctx.organization.id,
      taskId,
    );
    return { data: toTaskDto(task) };
  }

  @Patch(':taskId')
  @ProjectEntity('task', 'taskId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_TASKS)
  @LogActivity('Task', 'updated')
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
  ): Promise<{ data: TaskDto }> {
    const task = await this.tasksService.update(
      ctx.organization.id,
      taskId,
      body,
      user.id,
    );
    return { data: toTaskDto(task) };
  }

  @Patch(':taskId/move')
  @ProjectEntity('task', 'taskId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_TASKS)
  @LogActivity('Task', 'moved')
  async move(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(moveTaskSchema)) body: MoveTaskInput,
  ): Promise<{ data: TaskDto }> {
    const task = await this.tasksService.move(
      ctx.organization.id,
      taskId,
      body,
    );
    const withRelations = await this.tasksService.findByIdOrThrow(
      ctx.organization.id,
      task.id,
    );
    return { data: toTaskDto(withRelations) };
  }

  @Delete(':taskId')
  @ProjectEntity('task', 'taskId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_TASKS)
  @LogActivity('Task', 'deleted', 'taskId')
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<void> {
    await this.tasksService.remove(ctx.organization.id, taskId);
  }

  @Get(':taskId/history')
  @ProjectEntity('task', 'taskId')
  async history(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<{ data: TaskHistoryEntryDto[] }> {
    await this.tasksService.findByIdOrThrow(ctx.organization.id, taskId);
    const rows = await this.activityService.listForEntity(
      ctx.organization.id,
      'Task',
      taskId,
    );
    return { data: toTaskHistory(rows) };
  }

  @Get(':taskId/comments')
  @ProjectEntity('task', 'taskId')
  async listComments(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
  ): Promise<{ data: CommentDto[] }> {
    const comments = await this.commentsService.list(
      ctx.organization.id,
      taskId,
    );
    return { data: comments.map(toCommentDto) };
  }

  @Post(':taskId/comments')
  @ProjectEntity('task', 'taskId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_TASKS)
  @LogActivity('Comment', 'created')
  async createComment(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ): Promise<{ data: CommentDto }> {
    const comment = await this.commentsService.create(
      ctx.organization.id,
      taskId,
      user.id,
      body,
    );
    return { data: toCommentDto(comment) };
  }
}

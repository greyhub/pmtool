import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateProjectInput,
  createProjectSchema,
  ProjectDto,
  UpdateProjectInput,
  updateProjectSchema,
} from '@pmtool/shared-types';
import { ProjectsService } from './projects.service';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ProjectRolesGuard } from '../../common/guards/project-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { toProjectDto } from './project.mapper';
import { Project } from '@prisma/client';

@ApiTags('projects')
@Controller({ path: 'organizations/:orgSlug/projects', version: '1' })
@UseGuards(OrgMembershipGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'PM')
  @LogActivity('Project', 'created')
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ): Promise<{ data: ProjectDto }> {
    if (ctx.organization.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Không thể tạo dự án mới trong tổ chức đã lưu trữ',
      );
    }
    const project = await this.projectsService.create(
      ctx.organization.id,
      user.id,
      body,
    );
    return { data: toProjectDto(project) };
  }

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProjectDto[] }> {
    const projects = await this.projectsService.list(
      ctx.organization.id,
      user.id,
      ctx.role,
    );
    return { data: projects.map(toProjectDto) };
  }

  @Get(':projectKey')
  @UseGuards(ProjectGuard)
  async getOne(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('projectKey') projectKey: string,
  ): Promise<{ data: ProjectDto }> {
    const project = await this.projectsService.findByKeyOrThrow(
      ctx.organization.id,
      projectKey,
    );
    return { data: toProjectDto(project) };
  }

  @Patch(':projectKey')
  @UseGuards(ProjectGuard, ProjectRolesGuard)
  @Roles('OWNER', 'ADMIN', 'PM')
  @LogActivity('Project', 'updated')
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentProject() project: Project,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ): Promise<{ data: ProjectDto }> {
    const updated = await this.projectsService.update(
      ctx.organization.id,
      project.id,
      body,
      { id: user.id, role: ctx.role },
    );
    return { data: toProjectDto(updated) };
  }
}

import {
  Body,
  Controller,
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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { toProjectDto } from './project.mapper';

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
  ): Promise<{ data: ProjectDto[] }> {
    const projects = await this.projectsService.list(ctx.organization.id);
    return { data: projects.map(toProjectDto) };
  }

  @Get(':projectKey')
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
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'PM')
  @LogActivity('Project', 'updated')
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('projectKey') projectKey: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ): Promise<{ data: ProjectDto }> {
    const project = await this.projectsService.findByKeyOrThrow(
      ctx.organization.id,
      projectKey,
    );
    const updated = await this.projectsService.update(
      ctx.organization.id,
      project.id,
      body,
    );
    return { data: toProjectDto(updated) };
  }
}

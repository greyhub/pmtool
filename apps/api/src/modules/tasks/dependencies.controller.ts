import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  CreateDependencyInput,
  createDependencySchema,
  DependencyDto,
} from '@pmtool/shared-types';
import { DependenciesService } from './dependencies.service';
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
import { toDependencyDto } from './dependency.mapper';

@ApiTags('dependencies')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/dependencies',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: DependencyDto[] }> {
    const deps = await this.dependenciesService.list(
      ctx.organization.id,
      project.id,
    );
    return { data: deps.map(toDependencyDto) };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'PM', 'MEMBER')
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Body(new ZodValidationPipe(createDependencySchema))
    body: CreateDependencyInput,
  ): Promise<{ data: DependencyDto }> {
    const dep = await this.dependenciesService.create(
      ctx.organization.id,
      project.id,
      body,
    );
    return { data: toDependencyDto(dep) };
  }

  @Delete(':dependencyId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'PM', 'MEMBER')
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('dependencyId') dependencyId: string,
  ): Promise<void> {
    await this.dependenciesService.remove(ctx.organization.id, dependencyId);
  }
}

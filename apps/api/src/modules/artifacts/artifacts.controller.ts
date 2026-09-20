import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  ArtifactDetailDto,
  ArtifactSummaryDto,
  CreateArtifactInput,
  createArtifactSchema,
  UpdateArtifactInput,
  updateArtifactSchema,
} from '@pmtool/shared-types';
import { ArtifactsService } from './artifacts.service';
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
import { toArtifactDetailDto, toArtifactSummaryDto } from './artifact.mapper';
import { ProjectEntityGuard } from '../../common/guards/project-entity.guard';
import { ProjectEntity } from '../../common/decorators/project-entity.decorator';

const CAN_EDIT_ARTIFACTS = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('artifacts')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/artifacts',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard, ProjectEntityGuard)
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: ArtifactSummaryDto[] }> {
    const artifacts = await this.artifactsService.list(
      ctx.organization.id,
      project.id,
    );
    return { data: artifacts.map(toArtifactSummaryDto) };
  }

  @Get(':artifactId')
  @ProjectEntity('artifact', 'artifactId')
  async get(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('artifactId') artifactId: string,
  ): Promise<{ data: ArtifactDetailDto }> {
    const artifact = await this.artifactsService.getByIdOrThrow(
      ctx.organization.id,
      artifactId,
    );
    return { data: toArtifactDetailDto(artifact) };
  }

  @Post()
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_ARTIFACTS)
  @LogActivity('Artifact', 'created')
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createArtifactSchema))
    body: CreateArtifactInput,
  ): Promise<{ data: ArtifactDetailDto }> {
    const artifact = await this.artifactsService.create(
      ctx.organization.id,
      project.id,
      user.id,
      body,
    );
    return { data: toArtifactDetailDto(artifact) };
  }

  @Patch(':artifactId')
  @ProjectEntity('artifact', 'artifactId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_ARTIFACTS)
  @LogActivity('Artifact', 'updated')
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('artifactId') artifactId: string,
    @Body(new ZodValidationPipe(updateArtifactSchema))
    body: UpdateArtifactInput,
  ): Promise<{ data: ArtifactDetailDto }> {
    const artifact = await this.artifactsService.update(
      ctx.organization.id,
      artifactId,
      body,
    );
    return { data: toArtifactDetailDto(artifact) };
  }

  @Delete(':artifactId')
  @ProjectEntity('artifact', 'artifactId')
  @UseGuards(ProjectRolesGuard)
  @Roles(...CAN_EDIT_ARTIFACTS)
  @LogActivity('Artifact', 'deleted', 'artifactId')
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('artifactId') artifactId: string,
  ): Promise<void> {
    await this.artifactsService.remove(ctx.organization.id, artifactId);
  }
}

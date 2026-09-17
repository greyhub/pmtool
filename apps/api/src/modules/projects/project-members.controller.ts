import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Project } from '@prisma/client';
import {
  AddProjectMemberInput,
  addProjectMemberSchema,
  ProjectMemberDto,
  UpdateProjectMemberRoleInput,
  updateProjectMemberRoleSchema,
} from '@pmtool/shared-types';
import { ProjectMembersService } from './project-members.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { ProjectGuard } from '../../common/guards/project.guard';
import { ProjectMemberManageGuard } from '../../common/guards/project-member-manage.guard';
import {
  CurrentOrg,
  CurrentOrgContext,
} from '../../common/decorators/current-org.decorator';
import { CurrentProject } from '../../common/decorators/current-project.decorator';
import { toProjectMemberDto } from './project-member.mapper';

@ApiTags('project-members')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/members',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: ProjectMemberDto[] }> {
    const members = await this.projectMembersService.list(
      ctx.organization.id,
      project.id,
    );
    return { data: members.map(toProjectMemberDto) };
  }

  @Post()
  @UseGuards(ProjectMemberManageGuard)
  async add(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Body(new ZodValidationPipe(addProjectMemberSchema))
    body: AddProjectMemberInput,
  ): Promise<{ data: ProjectMemberDto }> {
    if (ctx.organization.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Không thể thêm thành viên dự án trong tổ chức đã lưu trữ',
      );
    }
    const member = await this.projectMembersService.add(
      ctx.organization.id,
      project.id,
      body,
    );
    return { data: toProjectMemberDto(member) };
  }

  @Patch(':projectMemberId')
  @UseGuards(ProjectMemberManageGuard)
  async updateRole(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Param('projectMemberId') projectMemberId: string,
    @Body(new ZodValidationPipe(updateProjectMemberRoleSchema))
    body: UpdateProjectMemberRoleInput,
  ): Promise<{ data: ProjectMemberDto }> {
    const member = await this.projectMembersService.updateRole(
      ctx.organization.id,
      project.id,
      projectMemberId,
      body.role,
    );
    return { data: toProjectMemberDto(member) };
  }

  @Delete(':projectMemberId')
  @UseGuards(ProjectMemberManageGuard)
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Param('projectMemberId') projectMemberId: string,
  ): Promise<void> {
    await this.projectMembersService.remove(
      ctx.organization.id,
      project.id,
      projectMemberId,
    );
  }
}

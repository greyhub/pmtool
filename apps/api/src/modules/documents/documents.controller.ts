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
  CreateProjectDocumentInput,
  createProjectDocumentSchema,
  ProjectDocumentDto,
  UpdateProjectDocumentInput,
  updateProjectDocumentSchema,
} from '@pmtool/shared-types';
import { DocumentsService } from './documents.service';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
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
import { toProjectDocumentDto } from './document.mapper';

const CAN_EDIT_DOCUMENTS = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('documents')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/documents',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: ProjectDocumentDto[] }> {
    const docs = await this.documentsService.list(
      ctx.organization.id,
      project.id,
    );
    return { data: docs.map(toProjectDocumentDto) };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_DOCUMENTS)
  @LogActivity('ProjectDocument', 'created')
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectDocumentSchema))
    body: CreateProjectDocumentInput,
  ): Promise<{ data: ProjectDocumentDto }> {
    const doc = await this.documentsService.create(
      ctx.organization.id,
      project.id,
      user.id,
      body,
    );
    return { data: toProjectDocumentDto(doc) };
  }

  @Patch(':documentId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_DOCUMENTS)
  @LogActivity('ProjectDocument', 'updated')
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('documentId') documentId: string,
    @Body(new ZodValidationPipe(updateProjectDocumentSchema))
    body: UpdateProjectDocumentInput,
  ): Promise<{ data: ProjectDocumentDto }> {
    const doc = await this.documentsService.update(
      ctx.organization.id,
      documentId,
      body,
    );
    return { data: toProjectDocumentDto(doc) };
  }

  @Delete(':documentId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_DOCUMENTS)
  @LogActivity('ProjectDocument', 'deleted', 'documentId')
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.documentsService.remove(ctx.organization.id, documentId);
  }
}

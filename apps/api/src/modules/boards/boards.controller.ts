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
  BoardColumnDto,
  CreateBoardColumnInput,
  createBoardColumnSchema,
  UpdateBoardColumnInput,
  updateBoardColumnSchema,
} from '@pmtool/shared-types';
import { BoardsService } from './boards.service';
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
import { toBoardColumnDto } from './board-column.mapper';

const CAN_EDIT_BOARD = ['OWNER', 'ADMIN', 'PM', 'MEMBER'] as const;

@ApiTags('boards')
@Controller({
  path: 'organizations/:orgSlug/projects/:projectKey/board-columns',
  version: '1',
})
@UseGuards(OrgMembershipGuard, ProjectGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  async list(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
  ): Promise<{ data: BoardColumnDto[] }> {
    const columns = await this.boardsService.list(
      ctx.organization.id,
      project.id,
    );
    return { data: columns.map(toBoardColumnDto) };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_BOARD)
  async create(
    @CurrentOrg() ctx: CurrentOrgContext,
    @CurrentProject() project: Project,
    @Body(new ZodValidationPipe(createBoardColumnSchema))
    body: CreateBoardColumnInput,
  ): Promise<{ data: BoardColumnDto }> {
    const column = await this.boardsService.create(
      ctx.organization.id,
      project.id,
      body,
    );
    return { data: toBoardColumnDto(column) };
  }

  @Patch(':columnId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_BOARD)
  async update(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('columnId') columnId: string,
    @Body(new ZodValidationPipe(updateBoardColumnSchema))
    body: UpdateBoardColumnInput,
  ): Promise<{ data: BoardColumnDto }> {
    const column = await this.boardsService.update(
      ctx.organization.id,
      columnId,
      body,
    );
    return { data: toBoardColumnDto(column) };
  }

  @Delete(':columnId')
  @UseGuards(RolesGuard)
  @Roles(...CAN_EDIT_BOARD)
  async remove(
    @CurrentOrg() ctx: CurrentOrgContext,
    @Param('columnId') columnId: string,
  ): Promise<void> {
    await this.boardsService.remove(ctx.organization.id, columnId);
  }
}

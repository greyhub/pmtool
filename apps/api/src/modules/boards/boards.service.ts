import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardColumn } from '@prisma/client';
import {
  CreateBoardColumnInput,
  UpdateBoardColumnInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    projectId: string,
  ): Promise<BoardColumn[]> {
    return this.prisma.db.boardColumn.findMany({
      where: { organizationId, projectId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async create(
    organizationId: string,
    projectId: string,
    input: CreateBoardColumnInput,
  ): Promise<BoardColumn> {
    const last = await this.prisma.db.boardColumn.findFirst({
      where: { organizationId, projectId },
      orderBy: { orderIndex: 'desc' },
    });
    return this.prisma.db.boardColumn.create({
      data: {
        organizationId,
        projectId,
        name: input.name,
        wipLimit: input.wipLimit,
        orderIndex: (last?.orderIndex ?? 0) + 1000,
      },
    });
  }

  async update(
    organizationId: string,
    columnId: string,
    input: UpdateBoardColumnInput,
  ): Promise<BoardColumn> {
    await this.findByIdOrThrow(organizationId, columnId);
    return this.prisma.db.boardColumn.update({
      where: { id: columnId },
      data: {
        name: input.name,
        wipLimit: input.wipLimit,
        orderIndex: input.orderIndex,
      },
    });
  }

  async remove(organizationId: string, columnId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, columnId);
    await this.prisma.db.$transaction([
      this.prisma.db.task.updateMany({
        where: { organizationId, boardColumnId: columnId },
        data: { boardColumnId: null },
      }),
      this.prisma.db.boardColumn.delete({ where: { id: columnId } }),
    ]);
  }

  private async findByIdOrThrow(
    organizationId: string,
    columnId: string,
  ): Promise<BoardColumn> {
    const column = await this.prisma.db.boardColumn.findUnique({
      where: { id: columnId },
    });
    if (!column || column.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy cột bảng');
    }
    return column;
  }
}

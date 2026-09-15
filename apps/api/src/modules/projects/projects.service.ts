import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Project } from '@prisma/client';
import { CreateProjectInput, UpdateProjectInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    createdById: string,
    input: CreateProjectInput,
  ): Promise<Project> {
    const existing = await this.prisma.db.project.findUnique({
      where: { organizationId_key: { organizationId, key: input.key } },
    });
    if (existing) {
      throw new ConflictException('Mã dự án đã tồn tại trong tổ chức này');
    }

    return this.prisma.db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId,
          key: input.key,
          name: input.name,
          description: input.description,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          targetEndDate: input.targetEndDate
            ? new Date(input.targetEndDate)
            : undefined,
          createdById,
        },
      });
      await tx.projectMember.create({
        data: {
          organizationId,
          projectId: project.id,
          userId: createdById,
          role: 'OWNER',
        },
      });
      await tx.boardColumn.createMany({
        data: [
          {
            organizationId,
            projectId: project.id,
            name: 'Việc cần làm',
            orderIndex: 1,
          },
          {
            organizationId,
            projectId: project.id,
            name: 'Đang thực hiện',
            orderIndex: 2,
          },
          {
            organizationId,
            projectId: project.id,
            name: 'Hoàn thành',
            orderIndex: 3,
          },
        ],
      });
      return project;
    });
  }

  async list(organizationId: string): Promise<Project[]> {
    return this.prisma.db.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByKeyOrThrow(
    organizationId: string,
    key: string,
  ): Promise<Project> {
    const project = await this.prisma.db.project.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }
    return project;
  }

  async update(
    organizationId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    return this.prisma.db.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        startDate:
          input.startDate === undefined
            ? undefined
            : input.startDate
              ? new Date(input.startDate)
              : null,
        targetEndDate:
          input.targetEndDate === undefined
            ? undefined
            : input.targetEndDate
              ? new Date(input.targetEndDate)
              : null,
      },
    });
  }
}

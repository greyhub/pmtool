import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectDocument } from '@prisma/client';
import {
  CreateProjectDocumentInput,
  UpdateProjectDocumentInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const OWNER_SELECT = { id: true, fullName: true, avatarUrl: true } as const;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, projectId: string) {
    return this.prisma.db.projectDocument.findMany({
      where: { organizationId, projectId },
      include: { owner: { select: OWNER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    input: CreateProjectDocumentInput,
  ) {
    return this.prisma.db.projectDocument.create({
      data: {
        organizationId,
        projectId,
        title: input.title,
        category: input.category,
        version: input.version,
        status: input.status,
        url: input.url,
        ownerId: input.ownerId,
        description: input.description,
        createdById: userId,
      },
      include: { owner: { select: OWNER_SELECT } },
    });
  }

  async update(
    organizationId: string,
    documentId: string,
    input: UpdateProjectDocumentInput,
  ) {
    await this.findByIdOrThrow(organizationId, documentId);
    return this.prisma.db.projectDocument.update({
      where: { id: documentId },
      data: {
        title: input.title,
        category: input.category,
        version: input.version,
        status: input.status,
        url: input.url,
        ownerId: input.ownerId,
        description: input.description,
      },
      include: { owner: { select: OWNER_SELECT } },
    });
  }

  async remove(organizationId: string, documentId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, documentId);
    await this.prisma.db.projectDocument.delete({ where: { id: documentId } });
  }

  private async findByIdOrThrow(
    organizationId: string,
    documentId: string,
  ): Promise<ProjectDocument> {
    const doc = await this.prisma.db.projectDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc || doc.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }
    return doc;
  }
}

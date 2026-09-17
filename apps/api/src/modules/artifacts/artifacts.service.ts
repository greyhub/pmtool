import { Injectable, NotFoundException } from '@nestjs/common';
import { Artifact } from '@prisma/client';
import { CreateArtifactInput, UpdateArtifactInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

// Excludes htmlContent — a list response has no business carrying up to
// 200,000 chars per row across every artifact in a project.
const SUMMARY_SELECT = {
  id: true,
  organizationId: true,
  projectId: true,
  title: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ArtifactSummary = Pick<Artifact, keyof typeof SUMMARY_SELECT>;

@Injectable()
export class ArtifactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    projectId: string,
  ): Promise<ArtifactSummary[]> {
    return this.prisma.db.artifact.findMany({
      where: { organizationId, projectId },
      select: SUMMARY_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getByIdOrThrow(
    organizationId: string,
    artifactId: string,
  ): Promise<Artifact> {
    const artifact = await this.prisma.db.artifact.findUnique({
      where: { id: artifactId },
    });
    if (!artifact || artifact.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy artifact');
    }
    return artifact;
  }

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    input: CreateArtifactInput,
  ): Promise<Artifact> {
    return this.prisma.db.artifact.create({
      data: {
        organizationId,
        projectId,
        title: input.title,
        htmlContent: input.htmlContent ?? '',
        createdById: userId,
      },
    });
  }

  async update(
    organizationId: string,
    artifactId: string,
    input: UpdateArtifactInput,
  ): Promise<Artifact> {
    await this.getByIdOrThrow(organizationId, artifactId);
    return this.prisma.db.artifact.update({
      where: { id: artifactId },
      data: {
        title: input.title,
        htmlContent: input.htmlContent,
      },
    });
  }

  async remove(organizationId: string, artifactId: string): Promise<void> {
    await this.getByIdOrThrow(organizationId, artifactId);
    await this.prisma.db.artifact.delete({ where: { id: artifactId } });
  }
}

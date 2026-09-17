import { Artifact } from '@prisma/client';
import { ArtifactDetailDto, ArtifactSummaryDto } from '@pmtool/shared-types';

export function toArtifactSummaryDto(artifact: Artifact): ArtifactSummaryDto {
  return {
    id: artifact.id,
    organizationId: artifact.organizationId,
    projectId: artifact.projectId,
    title: artifact.title,
    createdById: artifact.createdById,
    createdAt: artifact.createdAt.toISOString(),
    updatedAt: artifact.updatedAt.toISOString(),
  };
}

export function toArtifactDetailDto(artifact: Artifact): ArtifactDetailDto {
  return {
    ...toArtifactSummaryDto(artifact),
    htmlContent: artifact.htmlContent,
  };
}

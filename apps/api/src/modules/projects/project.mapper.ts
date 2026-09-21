import { Project } from '@prisma/client';
import { ProjectDto } from '@pmtool/shared-types';

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    organizationId: project.organizationId,
    key: project.key,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate?.toISOString() ?? null,
    targetEndDate: project.targetEndDate?.toISOString() ?? null,
    sprintsEnabled: project.sprintsEnabled,
    estimationUnit: project.estimationUnit,
    createdById: project.createdById,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

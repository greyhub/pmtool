import { ProjectDocument, User } from '@prisma/client';
import { ProjectDocumentDto } from '@pmtool/shared-types';

type ProjectDocumentWithRelations = ProjectDocument & {
  owner?: Pick<User, 'id' | 'fullName' | 'avatarUrl'> | null;
};

export function toProjectDocumentDto(
  doc: ProjectDocumentWithRelations,
): ProjectDocumentDto {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    projectId: doc.projectId,
    title: doc.title,
    category: doc.category,
    version: doc.version,
    status: doc.status,
    url: doc.url,
    ownerId: doc.ownerId,
    owner: doc.owner
      ? {
          id: doc.owner.id,
          fullName: doc.owner.fullName,
          avatarUrl: doc.owner.avatarUrl,
        }
      : null,
    description: doc.description,
    createdById: doc.createdById,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

import { Stakeholder, User } from '@prisma/client';
import { StakeholderDto } from '@pmtool/shared-types';

type StakeholderWithRelations = Stakeholder & {
  user?: Pick<User, 'id' | 'fullName' | 'avatarUrl'> | null;
};

export function toStakeholderDto(
  stakeholder: StakeholderWithRelations,
): StakeholderDto {
  return {
    id: stakeholder.id,
    organizationId: stakeholder.organizationId,
    projectId: stakeholder.projectId,
    userId: stakeholder.userId,
    user: stakeholder.user
      ? {
          id: stakeholder.user.id,
          fullName: stakeholder.user.fullName,
          avatarUrl: stakeholder.user.avatarUrl,
        }
      : null,
    fullName: stakeholder.fullName,
    role: stakeholder.role,
    organizationName: stakeholder.organizationName,
    email: stakeholder.email,
    phone: stakeholder.phone,
    category: stakeholder.category,
    influence: stakeholder.influence,
    interest: stakeholder.interest,
    currentEngagement: stakeholder.currentEngagement,
    desiredEngagement: stakeholder.desiredEngagement,
    notes: stakeholder.notes,
    createdById: stakeholder.createdById,
    createdAt: stakeholder.createdAt.toISOString(),
    updatedAt: stakeholder.updatedAt.toISOString(),
  };
}

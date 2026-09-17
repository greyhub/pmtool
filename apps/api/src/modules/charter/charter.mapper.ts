import { ProjectCharter, User } from '@prisma/client';
import { ProjectCharterDto } from '@pmtool/shared-types';
import { fromRichText } from '../tasks/rich-text.util';

type CharterWithRelations = ProjectCharter & {
  projectManager?: Pick<User, 'id' | 'fullName' | 'avatarUrl'> | null;
  approvedBy?: Pick<User, 'id' | 'fullName' | 'avatarUrl'> | null;
};

export function toProjectCharterDto(
  charter: CharterWithRelations,
): ProjectCharterDto {
  return {
    id: charter.id,
    organizationId: charter.organizationId,
    projectId: charter.projectId,
    purpose: fromRichText(charter.purpose),
    objectives: fromRichText(charter.objectives),
    scopeSummary: fromRichText(charter.scopeSummary),
    milestonesSummary: charter.milestonesSummary,
    budgetSummary: charter.budgetSummary,
    assumptions: fromRichText(charter.assumptions),
    constraints: fromRichText(charter.constraints),
    sponsorName: charter.sponsorName,
    projectManagerId: charter.projectManagerId,
    projectManager: charter.projectManager
      ? {
          id: charter.projectManager.id,
          fullName: charter.projectManager.fullName,
          avatarUrl: charter.projectManager.avatarUrl,
        }
      : null,
    status: charter.status,
    approvedById: charter.approvedById,
    approvedBy: charter.approvedBy
      ? {
          id: charter.approvedBy.id,
          fullName: charter.approvedBy.fullName,
          avatarUrl: charter.approvedBy.avatarUrl,
        }
      : null,
    approvedAt: charter.approvedAt?.toISOString() ?? null,
    createdById: charter.createdById,
    createdAt: charter.createdAt.toISOString(),
    updatedAt: charter.updatedAt.toISOString(),
  };
}

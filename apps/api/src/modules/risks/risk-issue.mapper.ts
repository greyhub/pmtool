import { RiskIssue, User } from '@prisma/client';
import { RiskIssueDto } from '@pmtool/shared-types';

type RiskIssueWithRelations = RiskIssue & {
  owner?: Pick<User, 'id' | 'fullName' | 'avatarUrl'> | null;
};

export function toRiskIssueDto(risk: RiskIssueWithRelations): RiskIssueDto {
  return {
    id: risk.id,
    organizationId: risk.organizationId,
    projectId: risk.projectId,
    type: risk.type,
    title: risk.title,
    description: risk.description,
    probability: risk.probability,
    impact: risk.impact,
    severityScore: risk.severityScore,
    status: risk.status,
    ownerId: risk.ownerId,
    owner: risk.owner
      ? {
          id: risk.owner.id,
          fullName: risk.owner.fullName,
          avatarUrl: risk.owner.avatarUrl,
        }
      : null,
    dueDate: risk.dueDate?.toISOString() ?? null,
    createdById: risk.createdById,
    createdAt: risk.createdAt.toISOString(),
    updatedAt: risk.updatedAt.toISOString(),
  };
}

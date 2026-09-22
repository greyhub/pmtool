import { AppFeedback, Organization, User } from '@prisma/client';
import { FeedbackDto } from '@pmtool/shared-types';

type WithRelations = AppFeedback & {
  user: Pick<User, 'id' | 'fullName' | 'email'> | null;
  organization: Pick<Organization, 'name'> | null;
};

export function toFeedbackDto(row: WithRelations): FeedbackDto {
  return {
    id: row.id,
    userId: row.userId,
    user: row.user,
    organizationId: row.organizationId,
    organizationName: row.organization?.name ?? null,
    category: row.category,
    message: row.message,
    pageUrl: row.pageUrl,
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

import { Organization, OrgJoinRequest, User } from '@prisma/client';
import { JoinRequestDto } from '@pmtool/shared-types';

type WithRelations = OrgJoinRequest & {
  organization: Pick<Organization, 'name' | 'slug'>;
  user: Pick<
    User,
    'id' | 'email' | 'fullName' | 'avatarUrl' | 'mascotCharacter'
  >;
  decidedBy: Pick<User, 'fullName'> | null;
};

export function toJoinRequestDto(row: WithRelations): JoinRequestDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    organizationSlug: row.organization.slug,
    userId: row.userId,
    user: {
      id: row.user.id,
      email: row.user.email,
      fullName: row.user.fullName,
      avatarUrl: row.user.avatarUrl,
      mascotCharacter: row.user
        .mascotCharacter as JoinRequestDto['user']['mascotCharacter'],
    },
    message: row.message,
    status: row.status,
    decidedByName: row.decidedBy?.fullName ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

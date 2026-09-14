import { Membership, User } from '@prisma/client';
import { MembershipDto } from '@pmtool/shared-types';

type MembershipWithUser = Membership & {
  user?: Pick<User, 'id' | 'email' | 'fullName' | 'avatarUrl'>;
};

export function toMembershipDto(membership: MembershipWithUser): MembershipDto {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    user: membership.user
      ? {
          id: membership.user.id,
          email: membership.user.email,
          fullName: membership.user.fullName,
          avatarUrl: membership.user.avatarUrl,
        }
      : undefined,
  };
}

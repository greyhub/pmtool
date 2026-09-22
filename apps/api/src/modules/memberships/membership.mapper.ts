import { Membership, User } from '@prisma/client';
import { MembershipDto } from '@pmtool/shared-types';
import { isOnline } from '../presence/online.util';

type MemberUser = NonNullable<MembershipDto['user']>;

type MembershipWithUser = Membership & {
  user?: Pick<
    User,
    | 'id'
    | 'email'
    | 'fullName'
    | 'avatarUrl'
    | 'mascotCharacter'
    | 'lastActiveAt'
  >;
};

export function toMembershipDto(membership: MembershipWithUser): MembershipDto {
  const lastActiveAt = membership.user?.lastActiveAt ?? null;
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
          mascotCharacter: membership.user
            .mascotCharacter as MemberUser['mascotCharacter'],
        }
      : undefined,
    lastActiveAt: lastActiveAt?.toISOString() ?? null,
    online: isOnline(lastActiveAt),
  };
}

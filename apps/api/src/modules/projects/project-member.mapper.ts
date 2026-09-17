import { ProjectMember, User } from '@prisma/client';
import { ProjectMemberDto } from '@pmtool/shared-types';

type ProjectMemberWithUser = ProjectMember & {
  user?: Pick<User, 'id' | 'email' | 'fullName' | 'avatarUrl'>;
};

export function toProjectMemberDto(
  member: ProjectMemberWithUser,
): ProjectMemberDto {
  return {
    id: member.id,
    organizationId: member.organizationId,
    projectId: member.projectId,
    userId: member.userId,
    role: member.role,
    user: member.user
      ? {
          id: member.user.id,
          email: member.user.email,
          fullName: member.user.fullName,
          avatarUrl: member.user.avatarUrl,
        }
      : undefined,
    createdAt: member.createdAt.toISOString(),
  };
}

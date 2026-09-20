import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Rejects user ids that aren't members of the organization. Without this, any
 * caller could attach an arbitrary (even another tenant's) user id as an
 * assignee/owner and read that person's name and avatar back in the response.
 */
export async function assertOrgMembers(
  prisma: PrismaService,
  organizationId: string,
  userIds: Iterable<string | null | undefined>,
): Promise<void> {
  const wanted = Array.from(
    new Set(Array.from(userIds).filter((x): x is string => !!x)),
  );
  if (wanted.length === 0) return;
  const found = await prisma.db.membership.count({
    where: { organizationId, userId: { in: wanted } },
  });
  if (found !== wanted.length) {
    throw new BadRequestException(
      'Người được chọn không phải thành viên của tổ chức',
    );
  }
}

import { OrgRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves the caller's effective role for a specific project: an explicit
 * ProjectMember override row takes precedence; otherwise falls back to their
 * org-level role. For anyone without an override this is identical to the
 * org role, so existing behavior is unchanged unless a project explicitly
 * grants someone a different role.
 */
export async function resolveEffectiveProjectRole(
  prisma: PrismaService,
  projectId: string,
  userId: string,
  orgRole: OrgRole,
): Promise<OrgRole> {
  const override = await prisma.db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return override?.role ?? orgRole;
}

import { OrgRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Owners and admins see every project of the organization, private or not. */
export function seesAllProjects(role: OrgRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Ids of the organization's private projects this person may not see. Empty for
 * owners/admins. Every org-wide read (project list, dashboards, my tasks,
 * activity feed) excludes these; per-project routes are guarded by ProjectGuard.
 */
export async function hiddenProjectIds(
  prisma: PrismaService,
  organizationId: string,
  userId: string,
  role: OrgRole,
): Promise<string[]> {
  if (seesAllProjects(role)) return [];
  const rows = await prisma.db.project.findMany({
    where: {
      organizationId,
      isPrivate: true,
      members: { none: { userId } },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

'use client';

import { useMe, useOrganizationMembers, useProjectMembers } from '@pmtool/api-client';
import { permissionsFor, type OrgRole, type Permissions } from '@pmtool/shared-types';

/**
 * The caller's effective role in a project: a project-level override replaces
 * the organization role, exactly as the API resolves it.
 */
export function usePermissions(
  orgSlug: string | undefined,
  projectKey?: string,
): Permissions & { role: OrgRole | undefined } {
  const { data: me } = useMe();
  const { data: members } = useOrganizationMembers(orgSlug);
  const { data: projectMembers } = useProjectMembers(orgSlug, projectKey);

  const orgRole = members?.find((m) => m.userId === me?.id)?.role;
  const override = projectKey ? projectMembers?.find((m) => m.userId === me?.id)?.role : undefined;
  const role = override ?? orgRole;
  return { role, ...permissionsFor(role) };
}

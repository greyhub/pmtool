import type { OrgRole } from './enums';

/**
 * Who may do what, mirrored from the API's `@Roles(...)` declarations so the UI
 * can hide actions a person could not complete. The API stays the authority.
 */
export const EDITOR_ROLES: readonly OrgRole[] = ['OWNER', 'ADMIN', 'PM', 'MEMBER'];
export const MANAGER_ROLES: readonly OrgRole[] = ['OWNER', 'ADMIN', 'PM'];
export const SPONSOR_ROLES: readonly OrgRole[] = ['OWNER', 'ADMIN'];

export interface Permissions {
  /** Day-to-day work: tasks, risks, documents, deliverable drafts, WBS dictionary. */
  canEdit: boolean;
  /** Management artifacts: charter, scope, stakeholders, deliverable sign-off and deletion. */
  canManage: boolean;
  /** Sign-off on the charter and the scope statement. */
  canSponsor: boolean;
}

/** `role` undefined (still loading) is treated as fully permitted so controls don't flicker away. */
export function permissionsFor(role: OrgRole | undefined): Permissions {
  if (!role) return { canEdit: true, canManage: true, canSponsor: true };
  return {
    canEdit: EDITOR_ROLES.includes(role),
    canManage: MANAGER_ROLES.includes(role),
    canSponsor: SPONSOR_ROLES.includes(role),
  };
}

import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restricts a route to members whose org role is one of `roles`. Must run after OrgMembershipGuard. */
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);

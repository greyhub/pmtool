import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveEffectiveProjectRole } from './project-role.util';

const MANAGE_ROLES: OrgRole[] = ['OWNER', 'ADMIN'];

/**
 * Authorizes managing a project's ProjectMember overrides: allowed if the
 * caller's org role is OWNER/ADMIN, OR their effective role for this
 * specific project (via a ProjectMember override) is OWNER/ADMIN. The OR is
 * deliberate: it lets a delegated project owner manage their own project's
 * membership, while guaranteeing an org OWNER/ADMIN always has a fix-it path
 * even after downgrading their own effective role on a project. Must run
 * after OrgMembershipGuard, ProjectGuard.
 */
@Injectable()
export class ProjectMemberManageGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const orgRole: OrgRole | undefined = req.currentOrg?.role;
    const projectId: string | undefined = req.currentProject?.id;
    if (!orgRole || !projectId) {
      throw new ForbiddenException('Requires OWNER or ADMIN');
    }

    if (MANAGE_ROLES.includes(orgRole)) {
      return true;
    }

    const effectiveRole = await resolveEffectiveProjectRole(
      this.prisma,
      projectId,
      req.user.id,
      orgRole,
    );
    if (!MANAGE_ROLES.includes(effectiveRole)) {
      throw new ForbiddenException('Requires OWNER or ADMIN');
    }
    return true;
  }
}

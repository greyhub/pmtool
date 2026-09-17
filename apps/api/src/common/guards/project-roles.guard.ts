import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveEffectiveProjectRole } from './project-role.util';

/**
 * Same `@Roles(...)` metadata as RolesGuard, but checks the caller's
 * *effective* role for the current project (a ProjectMember override if one
 * exists, else their org role) instead of the org role directly. Must run
 * after OrgMembershipGuard, ProjectGuard.
 */
@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const orgRole: OrgRole | undefined = req.currentOrg?.role;
    const projectId: string | undefined = req.currentProject?.id;
    if (!orgRole || !projectId) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }

    const effectiveRole = await resolveEffectiveProjectRole(
      this.prisma,
      projectId,
      req.user.id,
      orgRole,
    );
    if (!requiredRoles.includes(effectiveRole)) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}

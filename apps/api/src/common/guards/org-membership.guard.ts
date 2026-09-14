import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getRequestContext } from '../context/request-context';

/**
 * Resolves the `:orgSlug` route param to an Organization, verifies the
 * current user is a member, attaches `req.currentOrg`, and mutates the
 * AsyncLocalStorage request context so the tenant-scoping Prisma extension
 * picks up `organizationId` for the rest of the request. Must run after
 * JwtAuthGuard (needs `req.user`).
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const orgSlug: string | undefined = req.params?.orgSlug;
    if (!orgSlug) {
      throw new NotFoundException('Missing organization in route');
    }

    const organization = await this.prisma.db.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const membership = await this.prisma.db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: req.user.id,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    req.currentOrg = {
      organization,
      membershipId: membership.id,
      role: membership.role,
    };

    const ctx = getRequestContext();
    if (ctx) {
      ctx.organizationId = organization.id;
      ctx.orgRole = membership.role;
    }

    return true;
  }
}

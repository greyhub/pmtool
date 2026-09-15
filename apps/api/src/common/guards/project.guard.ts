import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves the `:projectKey` route param to a Project scoped to the
 * already-resolved organization, and attaches `req.currentProject`. Must
 * run after OrgMembershipGuard (needs `req.currentOrg` / the tenant context
 * it establishes for the Prisma tenant-scoping extension).
 */
@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const projectKey: string | undefined = req.params?.projectKey;
    if (!projectKey) {
      throw new NotFoundException('Missing project in route');
    }

    const project = await this.prisma.db.project.findUnique({
      where: {
        organizationId_key: {
          organizationId: req.currentOrg.organization.id,
          key: projectKey,
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }

    req.currentProject = project;
    return true;
  }
}

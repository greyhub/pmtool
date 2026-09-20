import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PROJECT_ENTITY_KEY,
  ProjectEntityMeta,
} from '../decorators/project-entity.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Stops a caller from reaching an entity of project B through project A's URL.
 * Without it a user who holds a higher role on project A (a project-level
 * override) could edit project B's records by mixing the two in one request.
 * Must run after OrgMembershipGuard and ProjectGuard.
 */
@Injectable()
export class ProjectEntityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<ProjectEntityMeta | undefined>(
      PROJECT_ENTITY_KEY,
      context.getHandler(),
    );
    if (!meta) return true;

    const req = context.switchToHttp().getRequest();
    const id: string | undefined = req.params?.[meta.param];
    const projectId: string | undefined = req.currentProject?.id;
    if (!id || !projectId)
      throw new NotFoundException('Không tìm thấy dữ liệu');

    // The delegates differ per model, but all share findUnique({ where: { id }, select: { projectId } }).
    const delegate = this.prisma.db[meta.model] as unknown as {
      findUnique(args: {
        where: { id: string };
        select: { projectId: true };
      }): Promise<{ projectId: string } | null>;
    };
    const row = await delegate.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!row || row.projectId !== projectId)
      throw new NotFoundException('Không tìm thấy dữ liệu trong dự án này');
    return true;
  }
}

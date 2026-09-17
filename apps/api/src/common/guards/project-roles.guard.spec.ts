import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRolesGuard } from './project-roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

function makeContext(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ProjectRolesGuard', () => {
  function makeGuard(overrideRole: string | null) {
    const prisma = {
      db: {
        projectMember: {
          findUnique: vi
            .fn()
            .mockResolvedValue(overrideRole ? { role: overrideRole } : null),
        },
      },
    } as unknown as PrismaService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['OWNER', 'ADMIN', 'PM']),
    } as unknown as Reflector;
    return new ProjectRolesGuard(reflector, prisma);
  }

  it('allows access using the org role when no override exists', async () => {
    const guard = makeGuard(null);
    const req = {
      currentOrg: { role: 'PM' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
  });

  it('rejects using the org role when the org role is insufficient and no override exists', async () => {
    const guard = makeGuard(null);
    const req = {
      currentOrg: { role: 'VIEWER' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow();
  });

  it('grants access via a project-level override even when the org role is insufficient', async () => {
    const guard = makeGuard('PM');
    const req = {
      currentOrg: { role: 'VIEWER' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
  });

  it('rejects via a project-level override even when the org role would be sufficient', async () => {
    const guard = makeGuard('VIEWER');
    const req = {
      currentOrg: { role: 'PM' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow();
  });
});

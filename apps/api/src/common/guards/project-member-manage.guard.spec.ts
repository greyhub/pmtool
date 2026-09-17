import { ExecutionContext } from '@nestjs/common';
import { ProjectMemberManageGuard } from './project-member-manage.guard';
import { PrismaService } from '../../prisma/prisma.service';

function makeContext(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

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
  return new ProjectMemberManageGuard(prisma);
}

describe('ProjectMemberManageGuard', () => {
  it('allows an org OWNER even without any project-level override', async () => {
    const guard = makeGuard(null);
    const req = {
      currentOrg: { role: 'OWNER' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
  });

  it('allows an org OWNER even after downgrading their own effective role via an override (no self-lockout)', async () => {
    const guard = makeGuard('VIEWER');
    const req = {
      currentOrg: { role: 'OWNER' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
  });

  it('allows a plain org MEMBER who has been delegated project-level OWNER via an override', async () => {
    const guard = makeGuard('OWNER');
    const req = {
      currentOrg: { role: 'MEMBER' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
  });

  it('rejects a plain org PM with no override on this project', async () => {
    const guard = makeGuard(null);
    const req = {
      currentOrg: { role: 'PM' },
      currentProject: { id: 'proj_1' },
      user: { id: 'user_1' },
    };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow();
  });
});

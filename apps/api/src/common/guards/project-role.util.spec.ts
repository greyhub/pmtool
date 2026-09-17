import { resolveEffectiveProjectRole } from './project-role.util';
import { PrismaService } from '../../prisma/prisma.service';

describe('resolveEffectiveProjectRole', () => {
  function makePrisma(findUniqueResult: unknown) {
    return {
      db: {
        projectMember: {
          findUnique: vi.fn().mockResolvedValue(findUniqueResult),
        },
      },
    } as unknown as PrismaService;
  }

  it('returns the override role when a ProjectMember row exists', async () => {
    const prisma = makePrisma({ role: 'VIEWER' });

    const role = await resolveEffectiveProjectRole(
      prisma,
      'proj_1',
      'user_1',
      'PM',
    );

    expect(role).toBe('VIEWER');
  });

  it('falls back to the org role when no override exists', async () => {
    const prisma = makePrisma(null);

    const role = await resolveEffectiveProjectRole(
      prisma,
      'proj_1',
      'user_1',
      'PM',
    );

    expect(role).toBe('PM');
  });
});

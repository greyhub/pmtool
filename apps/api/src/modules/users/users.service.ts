import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import {
  MASCOT_CHARACTERS,
  UpdateUserPreferencesInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.db.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  async updatePreferences(
    id: string,
    input: UpdateUserPreferencesInput,
  ): Promise<User> {
    const current = await this.findByIdOrThrow(id);
    if (
      input.mascotCharacter &&
      input.mascotCharacter !== current.mascotCharacter
    ) {
      await this.assertCharacterAvailable(id, input.mascotCharacter);
    }
    return this.prisma.db.user.update({ where: { id }, data: input });
  }

  /**
   * Characters other members of any of my organizations already use — the
   * settings page marks these as taken instead of letting the user click into a 409.
   */
  async takenCharacters(
    userId: string,
  ): Promise<{ character: string; takenBy: string }[]> {
    const myOrgIds = (
      await this.prisma.db.membership.findMany({
        where: { userId },
        select: { organizationId: true },
      })
    ).map((m) => m.organizationId);
    if (myOrgIds.length === 0) return [];

    const others = await this.prisma.db.membership.findMany({
      where: { organizationId: { in: myOrgIds }, userId: { not: userId } },
      select: { user: { select: { fullName: true, mascotCharacter: true } } },
    });
    const taken = new Map<string, string>();
    for (const { user } of others) {
      if (!taken.has(user.mascotCharacter)) {
        taken.set(user.mascotCharacter, user.fullName);
      }
    }
    return Array.from(taken, ([character, takenBy]) => ({
      character,
      takenBy,
    }));
  }

  /**
   * Called right after someone becomes a member of an organization (invite accepted, join request
   * approved). Every account defaults to "fox" and nothing ever forced a new member to pick a distinct
   * one before this point — without it, two people who both never opened Settings silently collide on
   * the same character everywhere it matters (Gantt, leaderboard, the assignee picker). Reassigns to a
   * random free character across every org they're now in (so a wave of new members doesn't all line up
   * in the same bear-bunny-cat order); never touches someone who already has a character nobody else in
   * those orgs is using.
   */
  async resolveCharacterConflictOnJoin(userId: string): Promise<void> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { mascotCharacter: true },
    });
    if (!user) return;

    const myOrgIds = (
      await this.prisma.db.membership.findMany({
        where: { userId },
        select: { organizationId: true },
      })
    ).map((m) => m.organizationId);
    if (myOrgIds.length === 0) return;

    const others = await this.prisma.db.membership.findMany({
      where: { organizationId: { in: myOrgIds }, userId: { not: userId } },
      select: { user: { select: { mascotCharacter: true } } },
    });
    const takenByOthers = new Set(others.map((o) => o.user.mascotCharacter));
    if (!takenByOthers.has(user.mascotCharacter)) return;

    const free = MASCOT_CHARACTERS.filter((c) => !takenByOthers.has(c));
    if (free.length === 0) return; // every character is in use across these orgs — extremely unlikely (52 characters)
    const pick = free[Math.floor(Math.random() * free.length)]!;
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { mascotCharacter: pick },
    });
  }

  /**
   * Character uniqueness is scoped per-organization, not global — the
   * character field itself stays a single global-per-user value (moving it
   * to Membership would break the floating companion, which has no org
   * context on pages like /settings or /invite/accept). This endpoint has
   * no :orgSlug in its route, so it runs with no AsyncLocalStorage request
   * context — the tenant-scoping Prisma extension passes the cross-org
   * `organizationId: { in: ... }` query through unscoped, same mechanism
   * the Telegram digest cron already relies on.
   */
  private async assertCharacterAvailable(
    userId: string,
    character: string,
  ): Promise<void> {
    const myOrgIds = (
      await this.prisma.db.membership.findMany({
        where: { userId },
        select: { organizationId: true },
      })
    ).map((m) => m.organizationId);
    if (myOrgIds.length === 0) return;

    const conflict = await this.prisma.db.membership.findFirst({
      where: {
        organizationId: { in: myOrgIds },
        userId: { not: userId },
        user: { mascotCharacter: character },
      },
      select: { organization: { select: { name: true } } },
    });
    if (conflict) {
      throw new ConflictException(
        `Nhân vật này đã được dùng bởi một thành viên khác trong tổ chức "${conflict.organization.name}" — hãy chọn nhân vật khác.`,
      );
    }
  }
}

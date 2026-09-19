import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { UpdateUserPreferencesInput } from '@pmtool/shared-types';
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Membership, OrgRole } from '@prisma/client';
import { CreateInviteInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../auth/refresh-token.util';
import { MailService } from '../mail/mail.service';
import { inviteMail } from '../mail/mail-templates';
import { UsersService } from '../users/users.service';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @Optional() private readonly mail?: MailService,
  ) {}

  async listMembers(organizationId: string): Promise<Membership[]> {
    return this.prisma.db.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            mascotCharacter: true,
            lastActiveAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Only an OWNER may create, keep, change or remove the OWNER role — an ADMIN
   * must not be able to promote themselves (or a friend) or evict the owner.
   */
  private assertMayGrantOwner(actorRole: OrgRole) {
    if (actorRole !== 'OWNER') {
      throw new ForbiddenException(
        'Chỉ Chủ sở hữu (Owner) mới được cấp, thu hồi hoặc thay đổi vai trò Owner',
      );
    }
  }

  async createInvite(
    organizationId: string,
    invitedById: string,
    input: CreateInviteInput,
  ): Promise<{
    id: string;
    email: string;
    role: OrgRole;
    rawToken: string;
    expiresAt: Date;
  }> {
    const email = input.email.toLowerCase();

    const existingMember = await this.prisma.db.membership.findFirst({
      where: { organizationId, user: { email } },
    });
    if (existingMember) {
      throw new ConflictException(
        'Người này đã là thành viên của tổ chức — hãy đổi vai trò trực tiếp trong danh sách Thành viên thay vì mời lại',
      );
    }

    return this.prisma.db.$transaction(async (tx) => {
      // Re-inviting the same email replaces any still-pending invite rather
      // than stacking up duplicates with independently valid tokens/roles —
      // this also gives "resend" behavior for free.
      await tx.membershipInvite.deleteMany({
        where: { organizationId, email, acceptedAt: null },
      });

      const rawToken = generateRefreshToken();
      const invite = await tx.membershipInvite.create({
        data: {
          organizationId,
          email,
          role: input.role,
          tokenHash: hashRefreshToken(rawToken),
          invitedById,
          expiresAt: new Date(
            Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      });
      return {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        rawToken,
        expiresAt: invite.expiresAt,
      };
    });
  }

  /** Emails the invitation link; the link is still returned to the inviter as a fallback. */
  async emailInvite(
    invite: { email: string; role: OrgRole; rawToken: string },
    organizationName: string,
    inviterUserId: string,
  ): Promise<boolean> {
    if (!this.mail) return false;
    const inviter = await this.prisma.db.user.findUnique({
      where: { id: inviterUserId },
      select: { fullName: true, locale: true },
    });
    const locale = inviter?.locale === 'en' ? 'en' : 'vi';
    const url = this.mail.webUrl(
      `/${locale}/invite/accept?token=${invite.rawToken}`,
    );
    return this.mail.send(
      invite.email,
      inviteMail(
        locale,
        url,
        inviter?.fullName ?? 'PMTool',
        organizationName,
        invite.role,
      ),
    );
  }

  async cancelInvite(organizationId: string, inviteId: string): Promise<void> {
    const invite = await this.prisma.db.membershipInvite.findUnique({
      where: { id: inviteId },
    });
    if (
      !invite ||
      invite.organizationId !== organizationId ||
      invite.acceptedAt
    ) {
      throw new NotFoundException('Không tìm thấy lời mời đang chờ này');
    }
    await this.prisma.db.membershipInvite.delete({ where: { id: inviteId } });
  }

  async listPendingInvites(organizationId: string) {
    return this.prisma.db.membershipInvite.findMany({
      where: { organizationId, acceptedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptInvite(
    rawToken: string,
    userId: string,
    userEmail: string,
  ): Promise<Membership> {
    const tokenHash = hashRefreshToken(rawToken);
    const invite = await this.prisma.db.membershipInvite.findUnique({
      where: { tokenHash },
    });
    if (!invite) {
      throw new NotFoundException('Lời mời không tồn tại hoặc đã bị thu hồi');
    }
    if (invite.acceptedAt) {
      throw new BadRequestException('Lời mời đã được sử dụng');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Lời mời đã hết hạn');
    }
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        'Lời mời này không dành cho tài khoản đang đăng nhập',
      );
    }

    const membership = await this.prisma.db.$transaction(async (tx) => {
      const membership = await tx.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId,
          },
        },
        create: {
          organizationId: invite.organizationId,
          userId,
          role: invite.role,
        },
        update: { role: invite.role },
      });
      await tx.membershipInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return membership;
    });
    await this.usersService.resolveCharacterConflictOnJoin(userId);
    return membership;
  }

  async updateRole(
    organizationId: string,
    membershipId: string,
    role: OrgRole,
    actorRole: OrgRole,
  ): Promise<Membership> {
    const target = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );
    if (role === 'OWNER' || target.role === 'OWNER') {
      this.assertMayGrantOwner(actorRole);
    }
    if (target.role === 'OWNER' && role !== 'OWNER') {
      await this.assertNotLastOwner(organizationId, membershipId);
    }
    return this.prisma.db.membership.update({
      where: { id: membershipId },
      data: { role },
    });
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    actorRole: OrgRole,
  ): Promise<void> {
    const target = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );
    if (target.role === 'OWNER') {
      this.assertMayGrantOwner(actorRole);
      await this.assertNotLastOwner(organizationId, membershipId);
    }
    await this.prisma.db.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: membershipId } });
      // Clear any per-project role overrides too, so a later re-invite at a
      // lower role can't silently resurrect an old project-level override.
      await tx.projectMember.deleteMany({
        where: { organizationId, userId: target.userId },
      });
    });
  }

  private async getMembershipOrThrow(
    organizationId: string,
    membershipId: string,
  ): Promise<Membership> {
    const membership = await this.prisma.db.membership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    return membership;
  }

  private async assertNotLastOwner(
    organizationId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const ownerCount = await this.prisma.db.membership.count({
      where: {
        organizationId,
        role: 'OWNER',
        id: { not: excludingMembershipId },
      },
    });
    if (ownerCount === 0) {
      throw new BadRequestException(
        'Tổ chức phải có ít nhất một chủ sở hữu (Owner)',
      );
    }
  }
}

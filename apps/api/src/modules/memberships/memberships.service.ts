import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Membership, OrgRole } from '@prisma/client';
import { CreateInviteInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../auth/refresh-token.util';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(organizationId: string): Promise<Membership[]> {
    return this.prisma.db.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
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
    const rawToken = generateRefreshToken();
    const invite = await this.prisma.db.membershipInvite.create({
      data: {
        organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash: hashRefreshToken(rawToken),
        invitedById,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      rawToken,
      expiresAt: invite.expiresAt,
    };
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

    return this.prisma.db.$transaction(async (tx) => {
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
  }

  async updateRole(
    organizationId: string,
    membershipId: string,
    role: OrgRole,
  ): Promise<Membership> {
    const target = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );
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
  ): Promise<void> {
    const target = await this.getMembershipOrThrow(
      organizationId,
      membershipId,
    );
    if (target.role === 'OWNER') {
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

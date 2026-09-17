import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectMember } from '@prisma/client';
import { AddProjectMemberInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const memberInclude = {
  user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
} as const;

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, projectId: string) {
    return this.prisma.db.projectMember.findMany({
      where: { organizationId, projectId },
      include: memberInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(
    organizationId: string,
    projectId: string,
    input: AddProjectMemberInput,
  ): Promise<ProjectMember> {
    const membership = await this.prisma.db.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: input.userId },
      },
    });
    if (!membership) {
      throw new NotFoundException(
        'Người dùng này chưa là thành viên của tổ chức',
      );
    }

    const existing = await this.prisma.db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: input.userId } },
    });
    if (existing) {
      throw new ConflictException(
        'Thành viên này đã có vai trò riêng trong dự án, hãy cập nhật thay vì thêm mới',
      );
    }

    return this.prisma.db.projectMember.create({
      data: {
        organizationId,
        projectId,
        userId: input.userId,
        role: input.role,
      },
      include: memberInclude,
    });
  }

  async updateRole(
    organizationId: string,
    projectId: string,
    projectMemberId: string,
    role: AddProjectMemberInput['role'],
  ): Promise<ProjectMember> {
    await this.getOrThrow(organizationId, projectId, projectMemberId);
    return this.prisma.db.projectMember.update({
      where: { id: projectMemberId },
      data: { role },
      include: memberInclude,
    });
  }

  async remove(
    organizationId: string,
    projectId: string,
    projectMemberId: string,
  ): Promise<void> {
    await this.getOrThrow(organizationId, projectId, projectMemberId);
    await this.prisma.db.projectMember.delete({
      where: { id: projectMemberId },
    });
  }

  private async getOrThrow(
    organizationId: string,
    projectId: string,
    projectMemberId: string,
  ): Promise<ProjectMember> {
    const member = await this.prisma.db.projectMember.findUnique({
      where: { id: projectMemberId },
    });
    if (
      !member ||
      member.organizationId !== organizationId ||
      member.projectId !== projectId
    ) {
      throw new NotFoundException(
        'Không tìm thấy vai trò riêng của thành viên này',
      );
    }
    return member;
  }
}

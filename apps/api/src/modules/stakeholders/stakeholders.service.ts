import { Injectable, NotFoundException } from '@nestjs/common';
import { Stakeholder } from '@prisma/client';
import {
  CreateStakeholderInput,
  UpdateStakeholderInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const USER_SELECT = { id: true, fullName: true, avatarUrl: true } as const;

@Injectable()
export class StakeholdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, projectId: string) {
    return this.prisma.db.stakeholder.findMany({
      where: { organizationId, projectId },
      include: { user: { select: USER_SELECT } },
      orderBy: [
        { influence: 'desc' },
        { interest: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    input: CreateStakeholderInput,
  ) {
    return this.prisma.db.stakeholder.create({
      data: {
        organizationId,
        projectId,
        userId: input.userId,
        fullName: input.fullName,
        role: input.role,
        organizationName: input.organizationName,
        email: input.email,
        phone: input.phone,
        category: input.category,
        influence: input.influence,
        interest: input.interest,
        currentEngagement: input.currentEngagement,
        desiredEngagement: input.desiredEngagement,
        notes: input.notes,
        createdById: userId,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async update(
    organizationId: string,
    stakeholderId: string,
    input: UpdateStakeholderInput,
  ) {
    await this.findByIdOrThrow(organizationId, stakeholderId);
    return this.prisma.db.stakeholder.update({
      where: { id: stakeholderId },
      data: {
        userId: input.userId,
        fullName: input.fullName,
        role: input.role,
        organizationName: input.organizationName,
        email: input.email,
        phone: input.phone,
        category: input.category,
        influence: input.influence,
        interest: input.interest,
        currentEngagement: input.currentEngagement,
        desiredEngagement: input.desiredEngagement,
        notes: input.notes,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async remove(organizationId: string, stakeholderId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, stakeholderId);
    await this.prisma.db.stakeholder.delete({ where: { id: stakeholderId } });
  }

  private async findByIdOrThrow(
    organizationId: string,
    stakeholderId: string,
  ): Promise<Stakeholder> {
    const stakeholder = await this.prisma.db.stakeholder.findUnique({
      where: { id: stakeholderId },
    });
    if (!stakeholder || stakeholder.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy bên liên quan');
    }
    return stakeholder;
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Organization } from '@prisma/client';
import { CreateOrganizationInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: CreateOrganizationInput,
  ): Promise<Organization> {
    const existing = await this.prisma.db.organization.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new ConflictException(
        'Slug tổ chức đã tồn tại, vui lòng chọn slug khác',
      );
    }

    return this.prisma.db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.name, slug: input.slug },
      });
      await tx.membership.create({
        data: { organizationId: organization.id, userId, role: 'OWNER' },
      });
      return organization;
    });
  }

  async listForUser(
    userId: string,
    includeArchived = false,
  ): Promise<Organization[]> {
    const memberships = await this.prisma.db.membership.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { organization: { status: 'ACTIVE' } }),
      },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => m.organization);
  }

  async findBySlugOrThrow(slug: string): Promise<Organization> {
    const organization = await this.prisma.db.organization.findUnique({
      where: { slug },
    });
    if (!organization) {
      throw new NotFoundException('Không tìm thấy tổ chức');
    }
    return organization;
  }

  async updateName(
    organizationId: string,
    name: string,
  ): Promise<Organization> {
    return this.prisma.db.organization.update({
      where: { id: organizationId },
      data: { name },
    });
  }

  async archive(organizationId: string): Promise<Organization> {
    return this.prisma.db.organization.update({
      where: { id: organizationId },
      data: { status: 'ARCHIVED' },
    });
  }

  async unarchive(organizationId: string): Promise<Organization> {
    return this.prisma.db.organization.update({
      where: { id: organizationId },
      data: { status: 'ACTIVE' },
    });
  }
}

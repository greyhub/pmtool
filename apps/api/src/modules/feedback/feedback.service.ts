import { Injectable, NotFoundException } from '@nestjs/common';
import { AppFeedback, Organization, User } from '@prisma/client';
import { CreateFeedbackInput, UpdateFeedbackInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const AUTHOR_SELECT = { id: true, fullName: true, email: true } as const;

type WithRelations = AppFeedback & {
  user: Pick<User, 'id' | 'fullName' | 'email'> | null;
  organization: Pick<Organization, 'name'> | null;
};

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: CreateFeedbackInput,
  ): Promise<WithRelations> {
    let organizationId: string | null = null;
    if (input.organizationSlug) {
      const membership = await this.prisma.db.membership.findFirst({
        where: { userId, organization: { slug: input.organizationSlug } },
        select: { organizationId: true },
      });
      organizationId = membership?.organizationId ?? null;
    }
    return this.prisma.db.appFeedback.create({
      data: {
        userId,
        organizationId,
        category: input.category,
        message: input.message,
        pageUrl: input.pageUrl,
      },
      include: {
        user: { select: AUTHOR_SELECT },
        organization: { select: { name: true } },
      },
    });
  }

  async list(status?: string): Promise<WithRelations[]> {
    return this.prisma.db.appFeedback.findMany({
      where: status ? { status: status as AppFeedback['status'] } : undefined,
      include: {
        user: { select: AUTHOR_SELECT },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, input: UpdateFeedbackInput): Promise<WithRelations> {
    const existing = await this.prisma.db.appFeedback.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Feedback not found');
    return this.prisma.db.appFeedback.update({
      where: { id },
      data: input,
      include: {
        user: { select: AUTHOR_SELECT },
        organization: { select: { name: true } },
      },
    });
  }
}

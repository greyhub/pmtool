import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectCharter } from '@prisma/client';
import { UpsertCharterInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { toRichText } from '../tasks/rich-text.util';

const RELATIONS_INCLUDE = {
  projectManager: { select: { id: true, fullName: true, avatarUrl: true } },
  approvedBy: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

@Injectable()
export class CharterService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrNull(organizationId: string, projectId: string) {
    const charter = await this.prisma.db.projectCharter.findUnique({
      where: { projectId },
      include: RELATIONS_INCLUDE,
    });
    if (!charter || charter.organizationId !== organizationId) return null;
    return charter;
  }

  async upsert(
    organizationId: string,
    projectId: string,
    userId: string,
    input: UpsertCharterInput,
  ) {
    const existing = await this.prisma.db.projectCharter.findUnique({
      where: { projectId },
    });
    // Editing an already-approved charter invalidates the approval — the
    // sign-off no longer covers whatever changed underneath it.
    const revertsApproval = existing?.status === 'APPROVED';

    const fields = {
      purpose:
        input.purpose !== undefined ? toRichText(input.purpose) : undefined,
      objectives:
        input.objectives !== undefined
          ? toRichText(input.objectives)
          : undefined,
      scopeSummary:
        input.scopeSummary !== undefined
          ? toRichText(input.scopeSummary)
          : undefined,
      milestonesSummary: input.milestonesSummary,
      budgetSummary: input.budgetSummary,
      assumptions:
        input.assumptions !== undefined
          ? toRichText(input.assumptions)
          : undefined,
      constraints:
        input.constraints !== undefined
          ? toRichText(input.constraints)
          : undefined,
      sponsorName: input.sponsorName,
      projectManagerId: input.projectManagerId,
    };

    const charter = await this.prisma.db.projectCharter.upsert({
      where: { projectId },
      // The tenant-scoping extension does NOT auto-inject organizationId into
      // upsert's `create` branch (only into `where`, for matching) — must be
      // explicit here or this silently creates an unscoped row.
      create: {
        organizationId,
        projectId,
        createdById: userId,
        ...fields,
      },
      update: {
        ...fields,
        ...(revertsApproval
          ? { status: 'DRAFT' as const, approvedById: null, approvedAt: null }
          : {}),
      },
      include: RELATIONS_INCLUDE,
    });

    return charter;
  }

  async approve(
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<ProjectCharter> {
    const existing = await this.prisma.db.projectCharter.findUnique({
      where: { projectId },
    });
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException(
        'Chưa có điều lệ dự án để phê duyệt — hãy lưu điều lệ trước.',
      );
    }

    return this.prisma.db.projectCharter.update({
      where: { projectId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: RELATIONS_INCLUDE,
    });
  }
}

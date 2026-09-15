import { Injectable, NotFoundException } from '@nestjs/common';
import { RiskIssue } from '@prisma/client';
import {
  CreateRiskIssueInput,
  UpdateRiskIssueInput,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const OWNER_SELECT = { id: true, fullName: true, avatarUrl: true } as const;

/** probability x impact when both are known, otherwise unscored (e.g. an ISSUE, or a RISK not yet assessed). */
function computeSeverity(
  probability?: number | null,
  impact?: number | null,
): number | null {
  if (probability == null || impact == null) return null;
  return probability * impact;
}

@Injectable()
export class RisksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    projectId: string,
  ): Promise<
    (RiskIssue & {
      owner: { id: string; fullName: string; avatarUrl: string | null } | null;
    })[]
  > {
    return this.prisma.db.riskIssue.findMany({
      where: { organizationId, projectId },
      include: { owner: { select: OWNER_SELECT } },
      // Postgres defaults DESC to NULLS FIRST, which would float unscored
      // issues above high-severity risks — pin nulls to the bottom instead.
      orderBy: [
        { severityScore: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    input: CreateRiskIssueInput,
  ) {
    return this.prisma.db.riskIssue.create({
      data: {
        organizationId,
        projectId,
        type: input.type,
        title: input.title,
        description: input.description,
        probability: input.probability,
        impact: input.impact,
        severityScore: computeSeverity(input.probability, input.impact),
        status: input.status,
        ownerId: input.ownerId,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        createdById: userId,
      },
      include: { owner: { select: OWNER_SELECT } },
    });
  }

  async update(
    organizationId: string,
    riskId: string,
    input: UpdateRiskIssueInput,
  ) {
    const existing = await this.findByIdOrThrow(organizationId, riskId);
    const probability =
      input.probability !== undefined
        ? input.probability
        : existing.probability;
    const impact = input.impact !== undefined ? input.impact : existing.impact;
    return this.prisma.db.riskIssue.update({
      where: { id: riskId },
      data: {
        title: input.title,
        description: input.description,
        probability: input.probability,
        impact: input.impact,
        severityScore: computeSeverity(probability, impact),
        status: input.status,
        ownerId: input.ownerId,
        dueDate:
          input.dueDate === undefined
            ? undefined
            : input.dueDate
              ? new Date(input.dueDate)
              : null,
      },
      include: { owner: { select: OWNER_SELECT } },
    });
  }

  async remove(organizationId: string, riskId: string): Promise<void> {
    await this.findByIdOrThrow(organizationId, riskId);
    await this.prisma.db.riskIssue.delete({ where: { id: riskId } });
  }

  private async findByIdOrThrow(
    organizationId: string,
    riskId: string,
  ): Promise<RiskIssue> {
    const risk = await this.prisma.db.riskIssue.findUnique({
      where: { id: riskId },
    });
    if (!risk || risk.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy rủi ro/vấn đề');
    }
    return risk;
  }
}

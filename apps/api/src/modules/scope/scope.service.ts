import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectScope, WbsDictionaryEntry } from '@prisma/client';
import {
  ProjectScopeDto,
  ScopeMapDto,
  UpsertScopeInput,
  UpsertWbsDictionaryInput,
  WbsDictionaryDto,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { fromRichText, toRichText } from '../tasks/rich-text.util';
import { buildScopeMap } from './scope-map.builder';

type ScopeWithApprover = ProjectScope & {
  approvedBy?: { fullName: string } | null;
};

const rich = (v: string | undefined) =>
  v === undefined ? undefined : v === '' ? Prisma.JsonNull : toRichText(v);

export function toScopeDto(s: ScopeWithApprover): ProjectScopeDto {
  return {
    id: s.id,
    projectId: s.projectId,
    inScope: fromRichText(s.inScope),
    outOfScope: fromRichText(s.outOfScope),
    deliverablesSummary: fromRichText(s.deliverablesSummary),
    acceptanceCriteria: fromRichText(s.acceptanceCriteria),
    assumptions: fromRichText(s.assumptions),
    constraints: fromRichText(s.constraints),
    status: s.status,
    approvedById: s.approvedById,
    approvedByName: s.approvedBy?.fullName ?? null,
    approvedAt: s.approvedAt?.toISOString() ?? null,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function toDictionaryDto(e: WbsDictionaryEntry): WbsDictionaryDto {
  return {
    taskId: e.taskId,
    scopeDescription: fromRichText(e.scopeDescription),
    acceptanceCriteria: fromRichText(e.acceptanceCriteria),
    assumptions: fromRichText(e.assumptions),
    constraints: fromRichText(e.constraints),
    requiredResources: e.requiredResources,
    qualityRequirements: e.qualityRequirements,
    technicalReferences: e.technicalReferences,
    costEstimate: e.costEstimate,
    updatedAt: e.updatedAt.toISOString(),
  };
}

const APPROVER = { approvedBy: { select: { fullName: true } } } as const;

@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getScope(projectId: string): Promise<ProjectScopeDto | null> {
    const scope = await this.prisma.db.projectScope.findUnique({
      where: { projectId },
      include: APPROVER,
    });
    return scope ? toScopeDto(scope) : null;
  }

  async upsertScope(
    organizationId: string,
    projectId: string,
    userId: string,
    input: UpsertScopeInput,
  ): Promise<ProjectScopeDto> {
    const existing = await this.prisma.db.projectScope.findUnique({
      where: { projectId },
    });
    // Editing an approved scope voids the sign-off (same rule as the charter).
    const revertsApproval = existing?.status === 'APPROVED';
    const fields = {
      inScope: rich(input.inScope),
      outOfScope: rich(input.outOfScope),
      deliverablesSummary: rich(input.deliverablesSummary),
      acceptanceCriteria: rich(input.acceptanceCriteria),
      assumptions: rich(input.assumptions),
      constraints: rich(input.constraints),
    };
    const scope = await this.prisma.db.projectScope.upsert({
      where: { projectId },
      create: { organizationId, projectId, createdById: userId, ...fields },
      update: {
        ...fields,
        ...(revertsApproval
          ? { status: 'DRAFT' as const, approvedById: null, approvedAt: null }
          : {}),
      },
      include: APPROVER,
    });
    return toScopeDto(scope);
  }

  async approveScope(
    projectId: string,
    userId: string,
  ): Promise<ProjectScopeDto> {
    const existing = await this.prisma.db.projectScope.findUnique({
      where: { projectId },
    });
    if (!existing) {
      throw new NotFoundException(
        'Chưa có bản phạm vi dự án để phê duyệt — hãy lưu phạm vi trước.',
      );
    }
    const scope = await this.prisma.db.projectScope.update({
      where: { projectId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: APPROVER,
    });
    return toScopeDto(scope);
  }

  private async assertTaskInProject(taskId: string, projectId: string) {
    const task = await this.prisma.db.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task || task.projectId !== projectId) {
      throw new NotFoundException('Không tìm thấy công việc');
    }
  }

  async getDictionary(
    taskId: string,
    projectId: string,
  ): Promise<WbsDictionaryDto | null> {
    await this.assertTaskInProject(taskId, projectId);
    const entry = await this.prisma.db.wbsDictionaryEntry.findUnique({
      where: { taskId },
    });
    return entry ? toDictionaryDto(entry) : null;
  }

  async upsertDictionary(
    organizationId: string,
    projectId: string,
    taskId: string,
    userId: string,
    input: UpsertWbsDictionaryInput,
  ): Promise<WbsDictionaryDto> {
    await this.assertTaskInProject(taskId, projectId);
    const fields = {
      scopeDescription: rich(input.scopeDescription),
      acceptanceCriteria: rich(input.acceptanceCriteria),
      assumptions: rich(input.assumptions),
      constraints: rich(input.constraints),
      requiredResources: input.requiredResources,
      qualityRequirements: input.qualityRequirements,
      technicalReferences: input.technicalReferences,
      costEstimate: input.costEstimate,
      updatedById: userId,
    };
    const entry = await this.prisma.db.wbsDictionaryEntry.upsert({
      where: { taskId },
      create: { organizationId, taskId, ...fields },
      update: fields,
    });
    return toDictionaryDto(entry);
  }

  async scopeMap(projectId: string): Promise<ScopeMapDto> {
    const [tasks, deliverables, dictionary, dependencies, charter, scope] =
      await Promise.all([
        this.prisma.db.task.findMany({
          where: { projectId },
          select: {
            id: true,
            title: true,
            parentTaskId: true,
            nodeType: true,
            isMilestone: true,
            status: true,
            percentComplete: true,
            orderIndex: true,
          },
        }),
        this.prisma.db.deliverable.findMany({
          where: { projectId },
          select: {
            id: true,
            name: true,
            taskId: true,
            status: true,
            acceptanceCriteria: true,
          },
        }),
        this.prisma.db.wbsDictionaryEntry.findMany({
          where: { task: { projectId } },
        }),
        this.prisma.db.taskDependency.findMany({
          where: { predecessor: { projectId } },
          select: { predecessorId: true, successorId: true },
        }),
        this.prisma.db.projectCharter.findUnique({
          where: { projectId },
          select: { status: true },
        }),
        this.prisma.db.projectScope.findUnique({
          where: { projectId },
          select: { status: true },
        }),
      ]);

    return buildScopeMap({
      tasks,
      deliverables,
      dictionary: dictionary.map((e) => ({
        taskId: e.taskId,
        hasContent: fromRichText(e.scopeDescription) !== null,
        hasAcceptanceCriteria: fromRichText(e.acceptanceCriteria) !== null,
      })),
      dependencies: dependencies.map((d) => ({
        predecessorId: d.predecessorId,
        successorId: d.successorId,
      })),
      charterStatus: charter?.status ?? null,
      scopeStatus: scope?.status ?? null,
    });
  }
}

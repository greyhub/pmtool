import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Project } from '@prisma/client';
import {
  CreateProjectInput,
  findTemplate,
  UpdateProjectInput,
} from '@pmtool/shared-types';
import { toRichText } from '../tasks/rich-text.util';
import { planTemplate } from './template-plan';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    createdById: string,
    input: CreateProjectInput,
  ): Promise<Project> {
    const existing = await this.prisma.db.project.findUnique({
      where: { organizationId_key: { organizationId, key: input.key } },
    });
    if (existing) {
      throw new ConflictException('Mã dự án đã tồn tại trong tổ chức này');
    }

    return this.prisma.db.$transaction(
      async (tx) => {
        const project = await tx.project.create({
          data: {
            organizationId,
            key: input.key,
            name: input.name,
            description: input.description,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            targetEndDate: input.targetEndDate
              ? new Date(input.targetEndDate)
              : undefined,
            createdById,
          },
        });
        await tx.projectMember.create({
          data: {
            organizationId,
            projectId: project.id,
            userId: createdById,
            role: 'OWNER',
          },
        });
        await tx.boardColumn.createMany({
          data: [
            {
              organizationId,
              projectId: project.id,
              name: 'Việc cần làm',
              orderIndex: 1,
            },
            {
              organizationId,
              projectId: project.id,
              name: 'Đang thực hiện',
              orderIndex: 2,
            },
            {
              organizationId,
              projectId: project.id,
              name: 'Hoàn thành',
              orderIndex: 3,
            },
          ],
        });

        const template = input.templateId
          ? findTemplate(input.templateId)
          : undefined;
        if (template) {
          const lang = input.locale === 'en' ? 'en' : 'vi';
          const start = input.startDate
            ? new Date(input.startDate)
            : new Date();
          start.setUTCHours(12, 0, 0, 0);
          const plan = planTemplate(template, lang, start);

          // Scope statement (draft) — the sign-off is left to the team.
          await tx.projectScope.create({
            data: {
              organizationId,
              projectId: project.id,
              createdById,
              inScope: toRichText(template.scope.inScope[lang]),
              outOfScope: toRichText(template.scope.outOfScope[lang]),
              acceptanceCriteria: toRichText(
                template.scope.acceptanceCriteria[lang],
              ),
            },
          });

          const ids = new Map<string, string>();
          const base = Date.now();
          let seq = 0;
          for (const t of plan.tasks) {
            seq += 1;
            const created = await tx.task.create({
              data: {
                organizationId,
                projectId: project.id,
                humanKey: `${project.key}-${seq}`,
                parentTaskId: t.parentKey ? ids.get(t.parentKey) : undefined,
                title: t.title,
                nodeType: t.nodeType,
                isMilestone: t.isMilestone,
                startDate: t.start,
                dueDate: t.due,
                orderIndex: base + seq,
                createdById,
              },
            });
            ids.set(t.key, created.id);

            if (t.nodeType === 'WORK_PACKAGE' || t.nodeType === 'DELIVERABLE') {
              await tx.wbsDictionaryEntry.create({
                data: {
                  organizationId,
                  taskId: created.id,
                  scopeDescription: t.scope ? toRichText(t.scope) : undefined,
                  acceptanceCriteria: t.criteria
                    ? toRichText(t.criteria)
                    : undefined,
                  updatedById: createdById,
                },
              });
            }
            // A deliverable node gets its sign-off record so the coverage check starts clean.
            if (t.nodeType === 'DELIVERABLE') {
              await tx.deliverable.create({
                data: {
                  organizationId,
                  projectId: project.id,
                  taskId: created.id,
                  name: t.title,
                  acceptanceCriteria: t.criteria,
                  dueDate: t.due,
                  createdById,
                },
              });
            }
          }
          await tx.project.update({
            where: { id: project.id },
            data: {
              taskSequence: seq,
              startDate: project.startDate ?? plan.tasks[0]?.start,
              targetEndDate: project.targetEndDate ?? plan.end,
            },
          });

          for (const r of template.risks) {
            await tx.riskIssue.create({
              data: {
                organizationId,
                projectId: project.id,
                type: 'RISK',
                title: r.title[lang],
                probability: r.probability,
                impact: r.impact,
                severityScore: r.probability * r.impact,
                createdById,
              },
            });
          }
        }
        return template
          ? tx.project.findUniqueOrThrow({ where: { id: project.id } })
          : project;
      },
      { timeout: 30_000 },
    );
  }

  async list(organizationId: string): Promise<Project[]> {
    return this.prisma.db.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByKeyOrThrow(
    organizationId: string,
    key: string,
  ): Promise<Project> {
    const project = await this.prisma.db.project.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }
    return project;
  }

  async update(
    organizationId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    return this.prisma.db.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        startDate:
          input.startDate === undefined
            ? undefined
            : input.startDate
              ? new Date(input.startDate)
              : null,
        targetEndDate:
          input.targetEndDate === undefined
            ? undefined
            : input.targetEndDate
              ? new Date(input.targetEndDate)
              : null,
      },
    });
  }
}

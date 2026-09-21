import { BadRequestException, Injectable } from '@nestjs/common';
import { computeWbsCodes, WbsNodeType } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { parseCsv, stringifyCsv } from './csv';
import {
  parseTaskRows,
  ImportError,
  ImportTask,
  MAX_IMPORT_ROWS,
} from './task-import';
import { fromRichText, toRichText } from './rich-text.util';

const MAX_CSV_BYTES = 1_000_000;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

export interface ImportPreviewRow {
  line: number;
  title: string;
  nodeType: string;
  parent: string | null;
}

export interface ImportOutcome {
  committed: boolean;
  /** Tasks that passed validation (created when `committed`). */
  valid: number;
  errors: ImportError[];
  preview: ImportPreviewRow[];
}

@Injectable()
export class TaskCsvService {
  constructor(private readonly prisma: PrismaService) {}

  /** The project's WBS as a spreadsheet: one row per task, parents by key, ready to re-import. */
  async exportCsv(organizationId: string, projectId: string): Promise<string> {
    const tasks = await this.prisma.db.task.findMany({
      where: { organizationId, projectId },
      orderBy: { orderIndex: 'asc' },
      include: {
        assignees: { include: { user: { select: { email: true } } } },
      },
    });
    const codes = computeWbsCodes(tasks);
    const keyById = new Map(tasks.map((t) => [t.id, t.humanKey]));
    // Present in WBS order (code order), not creation order.
    const ordered = tasks
      .slice()
      .sort((a, b) =>
        compareCodes(codes.get(a.id) ?? '', codes.get(b.id) ?? ''),
      );

    const header = [
      'wbs_code',
      'ref',
      'parent',
      'title',
      'type',
      'status',
      'priority',
      'start',
      'due',
      'percent',
      'estimate_hours',
      'milestone',
      'assignee',
      'supporters',
      'description',
    ];
    const rows = ordered.map((t) => [
      codes.get(t.id) ?? '',
      t.humanKey,
      t.parentTaskId ? (keyById.get(t.parentTaskId) ?? '') : '',
      t.title,
      t.nodeType,
      t.status,
      t.priority,
      day(t.startDate),
      day(t.dueDate),
      t.percentComplete,
      t.estimateHours ?? '',
      t.isMilestone ? 'yes' : '',
      t.assignees.find((a) => a.role === 'PRIMARY')?.user.email ?? '',
      t.assignees
        .filter((a) => a.role === 'SUPPORT')
        .map((a) => a.user.email)
        .join(';'),
      fromRichText(t.description) ?? '',
    ]);
    return stringifyCsv([header, ...rows]);
  }

  /** Validates a CSV and, unless `dryRun`, creates every task in one transaction (all or nothing). */
  async importCsv(
    organizationId: string,
    projectId: string,
    createdById: string,
    csv: string,
    dryRun: boolean,
  ): Promise<ImportOutcome> {
    if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
      throw new BadRequestException('Tệp quá lớn (tối đa 1 MB)');
    }
    const db = this.prisma.db;
    const [existing, memberships] = await Promise.all([
      db.task.findMany({
        where: { organizationId, projectId },
        select: { id: true, humanKey: true, nodeType: true },
      }),
      db.membership.findMany({
        where: { organizationId },
        include: { user: { select: { id: true, email: true } } },
      }),
    ]);
    const result = parseTaskRows(parseCsv(csv), {
      existing: new Map(
        existing.map((t) => [
          t.humanKey.toUpperCase(),
          { id: t.id, nodeType: t.nodeType as WbsNodeType },
        ]),
      ),
      members: new Map(
        memberships.map((m) => [m.user.email.toLowerCase(), m.user.id]),
      ),
    });

    const byRef = new Map(
      result.tasks.filter((t) => t.ref).map((t) => [t.ref as string, t]),
    );
    const preview: ImportPreviewRow[] = result.tasks.slice(0, 30).map((t) => ({
      line: t.line,
      title: t.title,
      nodeType: t.nodeType,
      parent: t.parentRef
        ? (byRef.get(t.parentRef)?.title ?? t.parentRef)
        : null,
    }));
    const outcome: ImportOutcome = {
      committed: false,
      valid: result.tasks.length,
      errors: result.errors,
      preview,
    };
    if (dryRun || result.errors.length > 0 || result.tasks.length === 0)
      return outcome;

    await this.create(
      organizationId,
      projectId,
      createdById,
      result.tasks,
      result.promotedExistingIds,
    );
    return { ...outcome, committed: true };
  }

  private async create(
    organizationId: string,
    projectId: string,
    createdById: string,
    tasks: ImportTask[],
    promotedExistingIds: string[],
  ) {
    await this.prisma.db.$transaction(
      async (tx) => {
        const project = await tx.project.update({
          where: { id: projectId },
          data: { taskSequence: { increment: tasks.length } },
        });
        const firstKey = project.taskSequence - tasks.length + 1;
        const firstColumn = await tx.boardColumn.findFirst({
          where: { projectId },
          orderBy: { orderIndex: 'asc' },
        });
        if (promotedExistingIds.length > 0) {
          await tx.task.updateMany({
            where: { id: { in: promotedExistingIds } },
            data: { nodeType: 'WORK_PACKAGE' },
          });
        }

        const idByRef = new Map<string, string>();
        const base = Date.now();
        for (const [i, t] of tasks.entries()) {
          const created = await tx.task.create({
            data: {
              organizationId,
              projectId,
              humanKey: `${project.key}-${firstKey + i}`,
              parentTaskId:
                t.parentRef && idByRef.has(t.parentRef)
                  ? idByRef.get(t.parentRef)
                  : (t.parentExistingId ?? undefined),
              title: t.title,
              description: t.description
                ? toRichText(t.description)
                : undefined,
              status: t.status,
              completedAt: t.status === 'DONE' ? new Date() : undefined,
              priority: t.priority,
              nodeType: t.nodeType,
              isMilestone: t.isMilestone,
              startDate: t.startDate ?? undefined,
              dueDate: t.dueDate ?? undefined,
              percentComplete: t.percentComplete,
              estimateHours: t.estimateHours ?? undefined,
              orderIndex: base + i,
              boardColumnId: firstColumn?.id,
              createdById,
            },
          });
          if (t.ref) idByRef.set(t.ref, created.id);
          const assignees = [
            ...(t.assigneeId
              ? [{ userId: t.assigneeId, role: 'PRIMARY' as const }]
              : []),
            ...t.supporterIds.map((userId) => ({
              userId,
              role: 'SUPPORT' as const,
            })),
          ];
          if (assignees.length > 0) {
            await tx.taskAssignee.createMany({
              data: assignees.map((a) => ({
                organizationId,
                taskId: created.id,
                ...a,
              })),
            });
          }
        }
      },
      { timeout: 60_000 },
    );
  }
}

/** "1.2.10" sorts after "1.2.9": compare code segments as numbers. */
function compareCodes(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

export { MAX_IMPORT_ROWS };

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import {
  HistoryEntryDto,
  HistoryPageDto,
  HistoryQuery,
} from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { vnDayRangeUtc } from '../gamification/streak-date.util';

const DEFAULT_LIMIT = 50;

/** A cursor is just "where the last page ended", opaque to the client. */
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
    const createdAt = new Date(iso ?? '');
    if (!id || Number.isNaN(createdAt.getTime())) throw new Error('bad');
    return { createdAt, id };
  } catch {
    throw new BadRequestException('Con trỏ phân trang không hợp lệ');
  }
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One page of history, newest first. `where` fixes the scope (a project, or the whole organization); the query narrows it.
   * Asking for one entity returns its own changes and those filed under it (a task's assignees, dependencies and dictionary).
   */
  async page(
    scope: Prisma.EntityHistoryWhereInput,
    query: HistoryQuery,
    keyOfProject?: (id: string | null) => string | null,
  ): Promise<HistoryPageDto> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const and: Prisma.EntityHistoryWhereInput[] = [scope];
    if (query.entityType && query.entityId) {
      and.push({
        OR: [
          { entityType: query.entityType, entityId: query.entityId },
          { subjectType: query.entityType, subjectId: query.entityId },
        ],
      });
    } else if (query.entityType) {
      and.push({ entityType: query.entityType });
    }
    if (query.action) and.push({ action: query.action });
    if (query.actorId) and.push({ actorId: query.actorId });
    if (query.from)
      and.push({ createdAt: { gte: vnDayRangeUtc(query.from).start } });
    if (query.to) and.push({ createdAt: { lt: vnDayRangeUtc(query.to).end } });
    if (query.cursor) {
      const c = decodeCursor(query.cursor);
      and.push({
        OR: [
          { createdAt: { lt: c.createdAt } },
          { createdAt: c.createdAt, id: { lt: c.id } },
        ],
      });
    }

    const rows = await this.prisma.db.entityHistory.findMany({
      where: { AND: and },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        actor: { select: { id: true, fullName: true, mascotCharacter: true } },
      },
    });
    const more = rows.length > limit;
    const pageRows = more ? rows.slice(0, limit) : rows;

    const items: HistoryEntryDto[] = pageRows.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      action: r.action as HistoryEntryDto['action'],
      entityType: r.entityType,
      entityId: r.entityId,
      label: r.label,
      subject:
        r.subjectType && r.subjectId
          ? { type: r.subjectType, id: r.subjectId }
          : null,
      projectKey: keyOfProject ? keyOfProject(r.projectId) : null,
      actor: r.actor
        ? {
            id: r.actor.id,
            fullName: r.actor.fullName,
            mascotCharacter: r.actor.mascotCharacter,
          }
        : null,
      changes: (r.changes as HistoryEntryDto['changes']) ?? null,
      snapshot: (r.snapshot as HistoryEntryDto['snapshot']) ?? null,
    }));
    const last = pageRows[pageRows.length - 1];
    return {
      items,
      nextCursor: more && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  forProject(project: Project, query: HistoryQuery): Promise<HistoryPageDto> {
    return this.page({ projectId: project.id }, query, () => project.key);
  }

  async forOrganization(
    organizationId: string,
    projectKey: string | undefined,
    query: HistoryQuery,
  ): Promise<HistoryPageDto> {
    let scope: Prisma.EntityHistoryWhereInput = { organizationId };
    if (projectKey) {
      const project = await this.prisma.db.project.findFirst({
        where: { organizationId, key: projectKey },
      });
      if (!project) return { items: [], nextCursor: null };
      scope = { organizationId, projectId: project.id };
    }
    const projects = await this.prisma.db.project.findMany({
      where: { organizationId },
      select: { id: true, key: true },
    });
    const keys = new Map(projects.map((p) => [p.id, p.key]));
    return this.page(scope, query, (id) =>
      id ? (keys.get(id) ?? null) : null,
    );
  }
}

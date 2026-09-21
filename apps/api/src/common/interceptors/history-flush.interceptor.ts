import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { getRequestContext } from '../context/request-context';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Writes the history entries a request collected — but only once the handler has succeeded. If it threw (validation,
 * permission, a rolled-back transaction), the entries are dropped with the request: nothing is recorded for changes
 * that did not happen. The entries are awaited before the response goes out so a client that reads the history right
 * after a change always sees it.
 */
@Injectable()
export class HistoryFlushInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HistoryFlushInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (value) => {
        await this.flush();
        return value;
      }),
    );
  }

  private async flush(): Promise<void> {
    const ctx = getRequestContext();
    if (!ctx || !ctx.history || ctx.history.length === 0) return;
    // Deleting an organization deletes its history with it (that is what it means to erase a tenant), so the entries of a
    // request that removed one have nowhere to live — dropping them is intended, not a failure.
    const erased = new Set(
      ctx.history
        .filter((d) => d.entityType === 'Organization' && d.action === 'DELETE')
        .map((d) => d.entityId),
    );
    const drafts = ctx.history.filter((d) => !erased.has(d.organizationId));
    ctx.history = [];
    if (drafts.length === 0) return;
    try {
      await this.prisma.audit.entityHistory.createMany({
        data: drafts.map((d) => ({
          organizationId: d.organizationId,
          projectId: d.projectId,
          entityType: d.entityType,
          entityId: d.entityId,
          subjectType: d.subjectType,
          subjectId: d.subjectId,
          action: d.action,
          actorId: ctx.userId ?? null,
          label: d.label,
          changes: (d.changes ?? undefined) as never,
          snapshot: (d.snapshot ?? undefined) as never,
        })),
      });
    } catch (err) {
      this.logger.error(
        `Could not write ${drafts.length} history entries: ${(err as Error).message}`,
      );
    }
  }
}

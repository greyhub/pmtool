import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { historyExtension } from './history/history.extension';
import { tenantScopingExtension } from './tenant-scoping.extension';

/** How many connections the history client may hold (short reads and one insert per request; it never holds one while waiting). */
const AUDIT_POOL_SIZE = 4;

/** The same database, with the connection pool capped (unless the URL already sets it). */
function withPoolSize(
  url: string | undefined,
  size: number,
): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connection_limit'))
      u.searchParams.set('connection_limit', String(size));
    return u.toString();
  } catch {
    return url;
  }
}

function buildClients() {
  const main = new PrismaClient();
  // A SEPARATE client (its own pool) for reading the state before a change and for writing the history. If it shared the
  // application's pool, a request inside a transaction (holding one connection) would wait for a second one to read with
  // while other transactions did the same — with a small pool they would all wait for each other until they timed out.
  const audit = new PrismaClient({
    datasources: {
      db: { url: withPoolSize(process.env.DATABASE_URL, AUDIT_POOL_SIZE) },
    },
  });
  const db = main
    .$extends(tenantScopingExtension())
    .$extends(historyExtension(audit));
  return { db, audit };
}

export type TenantScopedPrismaClient = ReturnType<typeof buildClients>['db'];

/**
 * `db` is the tenant-scoping-extended client — all tenant-owned model access
 * must go through it (`this.prisma.db.membership...`), never through a raw
 * PrismaClient, or the automatic organizationId scoping is bypassed.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly clients = buildClients();
  readonly db: TenantScopedPrismaClient = this.clients.db;
  /**
   * The history client: raw (no tenant scoping, no history of its own) and on its own small connection pool. Only for writing
   * the history and reading the state before a change — never for application data.
   */
  readonly audit: PrismaClient = this.clients.audit;

  async onModuleInit(): Promise<void> {
    await this.db.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.db.$disconnect(), this.audit.$disconnect()]);
  }
}

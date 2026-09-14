import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopingExtension } from './tenant-scoping.extension';

function buildExtendedClient() {
  const client = new PrismaClient();
  return client.$extends(tenantScopingExtension());
}

export type TenantScopedPrismaClient = ReturnType<typeof buildExtendedClient>;

/**
 * `db` is the tenant-scoping-extended client — all tenant-owned model access
 * must go through it (`this.prisma.db.membership...`), never through a raw
 * PrismaClient, or the automatic organizationId scoping is bypassed.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly db: TenantScopedPrismaClient = buildExtendedClient();

  async onModuleInit(): Promise<void> {
    await this.db.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }
}

-- Full change history: every create / update / delete of the business entities, with the fields that changed
-- (before -> after) and, for deletes, a snapshot of what was removed. Written automatically by a Prisma extension.
CREATE TABLE "entity_history" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "label" TEXT,
    "changes" JSONB,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "entity_history_organizationId_createdAt_idx" ON "entity_history"("organizationId", "createdAt");
CREATE INDEX "entity_history_organizationId_entityType_entityId_createdAt_idx" ON "entity_history"("organizationId", "entityType", "entityId", "createdAt");
CREATE INDEX "entity_history_projectId_createdAt_idx" ON "entity_history"("projectId", "createdAt");
CREATE INDEX "entity_history_subjectType_subjectId_createdAt_idx" ON "entity_history"("subjectType", "subjectId", "createdAt");
CREATE INDEX "entity_history_actorId_idx" ON "entity_history"("actorId");
ALTER TABLE "entity_history" ADD CONSTRAINT "entity_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Keep the trail when a person deletes their account: the actor becomes "unknown", the change stays.
ALTER TABLE "entity_history" ADD CONSTRAINT "entity_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

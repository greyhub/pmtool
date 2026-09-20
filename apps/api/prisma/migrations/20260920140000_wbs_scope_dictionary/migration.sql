-- CreateEnum
CREATE TYPE "WbsNodeType" AS ENUM ('PHASE', 'DELIVERABLE', 'WORK_PACKAGE', 'ACTIVITY');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "nodeType" "WbsNodeType" NOT NULL DEFAULT 'ACTIVITY';

-- Backfill: parents become WBS levels. A root task with children is a phase;
-- a deeper task with children is a work package; leaves stay activities.
UPDATE "tasks" AS t
SET "nodeType" = 'PHASE'
WHERE t."parentTaskId" IS NULL
  AND EXISTS (SELECT 1 FROM "tasks" c WHERE c."parentTaskId" = t."id");

UPDATE "tasks" AS t
SET "nodeType" = 'WORK_PACKAGE'
WHERE t."parentTaskId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "tasks" c WHERE c."parentTaskId" = t."id");

-- CreateTable
CREATE TABLE "project_scopes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inScope" JSONB,
    "outOfScope" JSONB,
    "deliverablesSummary" JSONB,
    "acceptanceCriteria" JSONB,
    "assumptions" JSONB,
    "constraints" JSONB,
    "status" "CharterStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_dictionary_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "scopeDescription" JSONB,
    "acceptanceCriteria" JSONB,
    "assumptions" JSONB,
    "constraints" JSONB,
    "requiredResources" TEXT,
    "qualityRequirements" TEXT,
    "technicalReferences" TEXT,
    "costEstimate" DOUBLE PRECISION,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wbs_dictionary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_scopes_projectId_key" ON "project_scopes"("projectId");
CREATE INDEX "project_scopes_organizationId_idx" ON "project_scopes"("organizationId");
CREATE UNIQUE INDEX "wbs_dictionary_entries_taskId_key" ON "wbs_dictionary_entries"("taskId");
CREATE INDEX "wbs_dictionary_entries_organizationId_idx" ON "wbs_dictionary_entries"("organizationId");

-- AddForeignKey
ALTER TABLE "project_scopes" ADD CONSTRAINT "project_scopes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_scopes" ADD CONSTRAINT "project_scopes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_scopes" ADD CONSTRAINT "project_scopes_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wbs_dictionary_entries" ADD CONSTRAINT "wbs_dictionary_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wbs_dictionary_entries" ADD CONSTRAINT "wbs_dictionary_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

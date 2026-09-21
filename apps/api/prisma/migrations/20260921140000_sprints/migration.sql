-- CreateEnum
CREATE TYPE "EstimationUnit" AS ENUM ('POINTS', 'HOURS');
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "sprintsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "estimationUnit" "EstimationUnit" NOT NULL DEFAULT 'POINTS';
ALTER TABLE "tasks" ADD COLUMN "sprintId" TEXT, ADD COLUMN "storyPoints" INTEGER;

-- CreateTable
CREATE TABLE "sprints" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "committedLoad" DOUBLE PRECISION,
    "completedLoad" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sprints_organizationId_idx" ON "sprints"("organizationId");
CREATE INDEX "sprints_projectId_status_idx" ON "sprints"("projectId", "status");
CREATE INDEX "tasks_sprintId_idx" ON "tasks"("sprintId");
-- One active sprint per project, enforced by the database (a partial unique index cannot be expressed in schema.prisma).
CREATE UNIQUE INDEX "sprints_one_active_per_project" ON "sprints"("projectId") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Daily project reports: a per-day snapshot to compare against, and the moment a task was completed.
ALTER TABLE "tasks" ADD COLUMN "completedAt" TIMESTAMP(3);
-- Best available answer for work finished before this column existed.
UPDATE "tasks" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE';
CREATE INDEX "tasks_projectId_completedAt_idx" ON "tasks"("projectId", "completedAt");

CREATE TABLE "project_daily_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tasksTotal" INTEGER NOT NULL,
    "todo" INTEGER NOT NULL,
    "inProgress" INTEGER NOT NULL,
    "inReview" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "blocked" INTEGER NOT NULL,
    "overdue" INTEGER NOT NULL,
    "progressPct" DOUBLE PRECISION NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL,
    "openRisks" INTEGER NOT NULL,
    "openIssues" INTEGER NOT NULL,
    "deliverablesTotal" INTEGER NOT NULL,
    "deliverablesAccepted" INTEGER NOT NULL,
    "milestonesTotal" INTEGER NOT NULL,
    "milestonesDone" INTEGER NOT NULL,
    "sprintPlanned" DOUBLE PRECISION,
    "sprintDone" DOUBLE PRECISION,
    "activityCount" INTEGER NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "project_daily_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_daily_snapshots_projectId_date_key" ON "project_daily_snapshots"("projectId", "date");
CREATE INDEX "project_daily_snapshots_organizationId_idx" ON "project_daily_snapshots"("organizationId");
ALTER TABLE "project_daily_snapshots" ADD CONSTRAINT "project_daily_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_daily_snapshots" ADD CONSTRAINT "project_daily_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

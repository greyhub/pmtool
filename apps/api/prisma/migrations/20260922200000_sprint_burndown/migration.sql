-- Burndown: the state of a sprint at the end of each day, so remaining work can be charted against the ideal line.
CREATE TABLE "sprint_daily_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "planned" DOUBLE PRECISION NOT NULL,
    "done" DOUBLE PRECISION NOT NULL,
    "taskCount" INTEGER NOT NULL,
    "doneCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_daily_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sprint_daily_snapshots_sprintId_date_key" ON "sprint_daily_snapshots"("sprintId", "date");
CREATE INDEX "sprint_daily_snapshots_organizationId_idx" ON "sprint_daily_snapshots"("organizationId");
ALTER TABLE "sprint_daily_snapshots" ADD CONSTRAINT "sprint_daily_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprint_daily_snapshots" ADD CONSTRAINT "sprint_daily_snapshots_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

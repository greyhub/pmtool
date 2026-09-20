-- CreateEnum
CREATE TYPE "TaskAssigneeRole" AS ENUM ('PRIMARY', 'SUPPORT');

-- AlterTable
ALTER TABLE "task_assignees" ADD COLUMN "role" "TaskAssigneeRole" NOT NULL DEFAULT 'SUPPORT';

-- Backfill: on every task that already has assignees, the earliest-assigned
-- one (ties broken by userId) becomes the primary; the rest stay SUPPORT.
UPDATE "task_assignees" AS ta
SET "role" = 'PRIMARY'
FROM (
    SELECT DISTINCT ON ("taskId") "taskId", "userId"
    FROM "task_assignees"
    ORDER BY "taskId", "assignedAt", "userId"
) AS first_assignee
WHERE ta."taskId" = first_assignee."taskId" AND ta."userId" = first_assignee."userId";

-- At most one PRIMARY per task (not expressible in schema.prisma).
CREATE UNIQUE INDEX "task_assignees_one_primary_per_task" ON "task_assignees"("taskId") WHERE "role" = 'PRIMARY';

-- Private projects: visible only to org OWNER/ADMIN and explicit project members.
ALTER TABLE "projects" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- Lets the org-wide activity feed hide entries that belong to a private project.
ALTER TABLE "activity_logs" ADD COLUMN "projectId" TEXT;
UPDATE "activity_logs" SET "projectId" = "entityId" WHERE "entityType" = 'Project';
CREATE INDEX "activity_logs_organizationId_projectId_idx" ON "activity_logs"("organizationId", "projectId");

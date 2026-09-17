-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artifacts_organizationId_idx" ON "artifacts"("organizationId");

-- CreateIndex
CREATE INDEX "artifacts_projectId_idx" ON "artifacts"("projectId");

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CharterStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "StakeholderCategory" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "StakeholderLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "StakeholderEngagementLevel" AS ENUM ('UNAWARE', 'RESISTANT', 'NEUTRAL', 'SUPPORTIVE', 'LEADING');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CHARTER', 'PLAN', 'REPORT', 'CONTRACT', 'MEETING_NOTES', 'DESIGN', 'REQUIREMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'OBSOLETE');

-- CreateTable
CREATE TABLE "project_charters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "purpose" JSONB,
    "objectives" JSONB,
    "scopeSummary" JSONB,
    "milestonesSummary" TEXT,
    "budgetSummary" TEXT,
    "assumptions" JSONB,
    "constraints" JSONB,
    "sponsorName" TEXT,
    "projectManagerId" TEXT,
    "status" "CharterStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_charters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakeholders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "role" TEXT,
    "organizationName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "category" "StakeholderCategory" NOT NULL DEFAULT 'INTERNAL',
    "influence" "StakeholderLevel" NOT NULL DEFAULT 'MEDIUM',
    "interest" "StakeholderLevel" NOT NULL DEFAULT 'MEDIUM',
    "currentEngagement" "StakeholderEngagementLevel" NOT NULL DEFAULT 'NEUTRAL',
    "desiredEngagement" "StakeholderEngagementLevel" NOT NULL DEFAULT 'SUPPORTIVE',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "url" TEXT NOT NULL,
    "ownerId" TEXT,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_charters_projectId_key" ON "project_charters"("projectId");

-- CreateIndex
CREATE INDEX "project_charters_organizationId_idx" ON "project_charters"("organizationId");

-- CreateIndex
CREATE INDEX "stakeholders_organizationId_idx" ON "stakeholders"("organizationId");

-- CreateIndex
CREATE INDEX "stakeholders_projectId_idx" ON "stakeholders"("projectId");

-- CreateIndex
CREATE INDEX "project_documents_organizationId_idx" ON "project_documents"("organizationId");

-- CreateIndex
CREATE INDEX "project_documents_projectId_idx" ON "project_documents"("projectId");

-- AddForeignKey
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_charters" ADD CONSTRAINT "project_charters_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


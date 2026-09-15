-- CreateEnum
CREATE TYPE "RiskIssueType" AS ENUM ('RISK', 'ISSUE');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'ANALYZING', 'MITIGATING', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "risk_issues" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "RiskIssueType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "probability" INTEGER,
    "impact" INTEGER,
    "severityScore" INTEGER,
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_issues_organizationId_idx" ON "risk_issues"("organizationId");

-- CreateIndex
CREATE INDEX "risk_issues_projectId_status_idx" ON "risk_issues"("projectId", "status");

-- AddForeignKey
ALTER TABLE "risk_issues" ADD CONSTRAINT "risk_issues_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_issues" ADD CONSTRAINT "risk_issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_issues" ADD CONSTRAINT "risk_issues_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

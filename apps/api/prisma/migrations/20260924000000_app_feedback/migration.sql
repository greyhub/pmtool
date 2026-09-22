-- Feedback about PMTool itself (bugs, ideas, anything else), sent by any user to whoever runs the product.
-- Not tenant-scoped: the sender may belong to several organizations; organizationId is kept only for context.
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'IDEA', 'OTHER');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DECLINED');

CREATE TABLE "app_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "category" "FeedbackCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "pageUrl" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "app_feedback_status_createdAt_idx" ON "app_feedback"("status", "createdAt");
CREATE INDEX "app_feedback_userId_idx" ON "app_feedback"("userId");
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

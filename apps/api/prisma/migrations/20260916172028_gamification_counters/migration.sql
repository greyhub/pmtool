-- AlterTable
ALTER TABLE "user_scores" ADD COLUMN     "commentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "risksResolvedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tasksCompletedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tasksCreatedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "percentComplete" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_quest_progress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "progressCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_quest_progress_organizationId_userId_questKey_period_key" ON "user_quest_progress"("organizationId", "userId", "questKey", "periodKey");

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

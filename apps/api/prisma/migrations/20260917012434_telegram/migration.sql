-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "telegramReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "telegram_link_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_codes_codeHash_key" ON "telegram_link_codes"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");

-- AddForeignKey
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


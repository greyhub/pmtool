-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dailyDigestHour" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN     "dailyDigestLastSentDate" DATE;


-- Presence ("online now") and login history.
-- lastActiveAt: throttled heartbeat updated on authenticated requests, powers the online indicator in a
-- member list. login_events: one row per real sign-in (never per silent token refresh).
ALTER TABLE "users" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

CREATE TYPE "LoginMethod" AS ENUM ('PASSWORD', 'GOOGLE');

CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "LoginMethod" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_events_userId_createdAt_idx" ON "login_events"("userId", "createdAt");
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

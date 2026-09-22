-- A user-initiated request to join an organization by slug, reviewed by an OWNER/ADMIN —
-- the opposite direction of membership_invites (which an admin sends to an email address).
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

CREATE TABLE "org_join_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_join_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "org_join_requests_organizationId_userId_key" ON "org_join_requests"("organizationId", "userId");
CREATE INDEX "org_join_requests_organizationId_status_idx" ON "org_join_requests"("organizationId", "status");
CREATE INDEX "org_join_requests_userId_idx" ON "org_join_requests"("userId");
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_join_requests" ADD CONSTRAINT "org_join_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

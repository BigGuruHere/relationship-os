-- Stage 6.7 - Project workstreams
-- Adds workstream lanes inside projects and optional links from leads, tasks, project notes, and project-deal links.

CREATE TYPE "public"."ProjectWorkstreamStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "public"."ProjectWorkstream" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "nameEnc" TEXT NOT NULL,
  "nameIdx" TEXT NOT NULL,
  "descriptionEnc" TEXT,
  "status" "public"."ProjectWorkstreamStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectWorkstream_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."MarketLead" ADD COLUMN "workstreamId" TEXT;
ALTER TABLE "public"."Task" ADD COLUMN "workstreamId" TEXT;
ALTER TABLE "public"."ProjectDeal" ADD COLUMN "workstreamId" TEXT;
ALTER TABLE "public"."ProjectNote" ADD COLUMN "workstreamId" TEXT;

CREATE UNIQUE INDEX "ProjectWorkstream_projectId_nameIdx_key" ON "public"."ProjectWorkstream"("projectId", "nameIdx");
CREATE INDEX "ProjectWorkstream_userId_projectId_status_idx" ON "public"."ProjectWorkstream"("userId", "projectId", "status");
CREATE INDEX "ProjectWorkstream_userId_status_idx" ON "public"."ProjectWorkstream"("userId", "status");
CREATE INDEX "ProjectWorkstream_nameIdx_idx" ON "public"."ProjectWorkstream"("nameIdx");

CREATE INDEX "MarketLead_userId_workstreamId_idx" ON "public"."MarketLead"("userId", "workstreamId");
CREATE INDEX "Task_userId_workstreamId_idx" ON "public"."Task"("userId", "workstreamId");
CREATE INDEX "ProjectDeal_userId_workstreamId_idx" ON "public"."ProjectDeal"("userId", "workstreamId");
CREATE INDEX "ProjectNote_userId_workstreamId_createdAt_idx" ON "public"."ProjectNote"("userId", "workstreamId", "createdAt");

ALTER TABLE "public"."ProjectWorkstream" ADD CONSTRAINT "ProjectWorkstream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ProjectWorkstream" ADD CONSTRAINT "ProjectWorkstream_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "public"."ProjectWorkstream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "public"."ProjectWorkstream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProjectDeal" ADD CONSTRAINT "ProjectDeal_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "public"."ProjectWorkstream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProjectNote" ADD CONSTRAINT "ProjectNote_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "public"."ProjectWorkstream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

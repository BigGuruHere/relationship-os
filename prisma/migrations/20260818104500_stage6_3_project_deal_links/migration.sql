-- Stage 6.3: Direct Project ↔ Deal links.
-- Tasks can still relate to both a project and a deal, but this table records
-- that the deal belongs to the project rather than relying on task context.

CREATE TABLE IF NOT EXISTS "public"."ProjectDeal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "labelEnc" TEXT,
  "notesEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDeal_projectId_dealId_key" ON "public"."ProjectDeal"("projectId", "dealId");
CREATE INDEX IF NOT EXISTS "ProjectDeal_userId_projectId_idx" ON "public"."ProjectDeal"("userId", "projectId");
CREATE INDEX IF NOT EXISTS "ProjectDeal_userId_dealId_idx" ON "public"."ProjectDeal"("userId", "dealId");
CREATE INDEX IF NOT EXISTS "ProjectDeal_userId_createdAt_idx" ON "public"."ProjectDeal"("userId", "createdAt");

ALTER TABLE "public"."ProjectDeal"
  ADD CONSTRAINT "ProjectDeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ProjectDeal"
  ADD CONSTRAINT "ProjectDeal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ProjectDeal"
  ADD CONSTRAINT "ProjectDeal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill links from existing tasks that already connect a project and deal.
INSERT INTO "public"."ProjectDeal" ("id", "userId", "projectId", "dealId", "createdAt", "updatedAt")
SELECT (t."projectId" || '-' || t."dealId"), t."userId", t."projectId", t."dealId", MIN(t."createdAt"), MAX(t."updatedAt")
FROM "public"."Task" t
WHERE t."projectId" IS NOT NULL
  AND t."dealId" IS NOT NULL
GROUP BY t."userId", t."projectId", t."dealId"
ON CONFLICT ("projectId", "dealId") DO NOTHING;

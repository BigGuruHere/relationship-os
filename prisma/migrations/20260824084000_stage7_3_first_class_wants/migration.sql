-- Stage 7.3 - First-class Wants.
-- Want becomes the demand-side working object for buyer mandates, acquisition criteria,
-- search briefs, and "keep an eye out" requests. OFFER records remain in ExchangeItem.

DO $$ BEGIN
  CREATE TYPE "public"."WantType" AS ENUM (
    'GENERAL',
    'ACQUISITION_CRITERIA',
    'BUYER_MANDATE',
    'REFERRAL_REQUEST',
    'SERVICE_NEED',
    'ASSET_SEARCH',
    'FUNDING_NEED',
    'PARTNERSHIP_INTEREST',
    'TALENT_NEED',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."WantStatus" AS ENUM (
    'NEW',
    'CLARIFYING_CRITERIA',
    'ACTIVE_MANDATE',
    'WATCHING_MARKET',
    'MATCHED',
    'CONVERTED_TO_DEAL',
    'CLOSED_INACTIVE',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."Want" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "wantType" "public"."WantType" NOT NULL DEFAULT 'GENERAL',
  "status" "public"."WantStatus" NOT NULL DEFAULT 'NEW',
  "titleEnc" TEXT NOT NULL,
  "descriptionEnc" TEXT,
  "summaryEnc" TEXT,
  "criteriaEnc" TEXT,
  "categoryEnc" TEXT,
  "geographyEnc" TEXT,
  "importance" INTEGER NOT NULL DEFAULT 3,
  "urgency" "public"."ExchangeUrgency" NOT NULL DEFAULT 'NORMAL',
  "timeHorizon" "public"."ExchangeTimeHorizon" NOT NULL DEFAULT 'ONGOING',
  "confidence" "public"."ExchangeConfidence" NOT NULL DEFAULT 'MEDIUM',
  "valueMinCents" INTEGER,
  "valueMaxCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "reviewAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "contactId" TEXT,
  "companyId" TEXT,
  "dealId" TEXT,
  "projectId" TEXT,
  "workstreamId" TEXT,
  "companyContactId" TEXT,
  "exchangeItemId" TEXT,
  "convertedDealId" TEXT,
  "embedding_vec" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Want_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."WantNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "wantId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL DEFAULT 'note',
  "bodyEnc" TEXT NOT NULL,
  "summaryEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WantNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Task" ADD COLUMN IF NOT EXISTS "wantId" TEXT;
ALTER TABLE "public"."MarketLead" ADD COLUMN IF NOT EXISTS "wantId" TEXT;

-- Foreign keys. Drop first so re-running after a partial deploy is safe.
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_userId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_contactId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_companyId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_dealId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_projectId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_workstreamId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "public"."ProjectWorkstream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_companyContactId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "public"."CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Want" DROP CONSTRAINT IF EXISTS "Want_exchangeItemId_fkey";
ALTER TABLE "public"."Want" ADD CONSTRAINT "Want_exchangeItemId_fkey" FOREIGN KEY ("exchangeItemId") REFERENCES "public"."ExchangeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WantNote" DROP CONSTRAINT IF EXISTS "WantNote_userId_fkey";
ALTER TABLE "public"."WantNote" ADD CONSTRAINT "WantNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."WantNote" DROP CONSTRAINT IF EXISTS "WantNote_wantId_fkey";
ALTER TABLE "public"."WantNote" ADD CONSTRAINT "WantNote_wantId_fkey" FOREIGN KEY ("wantId") REFERENCES "public"."Want"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Task" DROP CONSTRAINT IF EXISTS "Task_wantId_fkey";
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_wantId_fkey" FOREIGN KEY ("wantId") REFERENCES "public"."Want"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MarketLead" DROP CONSTRAINT IF EXISTS "MarketLead_wantId_fkey";
ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_wantId_fkey" FOREIGN KEY ("wantId") REFERENCES "public"."Want"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Want_exchangeItemId_key" ON "public"."Want"("exchangeItemId");
CREATE INDEX IF NOT EXISTS "Want_userId_wantType_idx" ON "public"."Want"("userId", "wantType");
CREATE INDEX IF NOT EXISTS "Want_userId_status_idx" ON "public"."Want"("userId", "status");
CREATE INDEX IF NOT EXISTS "Want_userId_urgency_idx" ON "public"."Want"("userId", "urgency");
CREATE INDEX IF NOT EXISTS "Want_userId_timeHorizon_idx" ON "public"."Want"("userId", "timeHorizon");
CREATE INDEX IF NOT EXISTS "Want_userId_confidence_idx" ON "public"."Want"("userId", "confidence");
CREATE INDEX IF NOT EXISTS "Want_userId_contactId_idx" ON "public"."Want"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "Want_userId_companyId_idx" ON "public"."Want"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "Want_userId_dealId_idx" ON "public"."Want"("userId", "dealId");
CREATE INDEX IF NOT EXISTS "Want_userId_projectId_idx" ON "public"."Want"("userId", "projectId");
CREATE INDEX IF NOT EXISTS "Want_userId_workstreamId_idx" ON "public"."Want"("userId", "workstreamId");
CREATE INDEX IF NOT EXISTS "Want_userId_companyContactId_idx" ON "public"."Want"("userId", "companyContactId");
CREATE INDEX IF NOT EXISTS "Want_userId_reviewAt_idx" ON "public"."Want"("userId", "reviewAt");
CREATE INDEX IF NOT EXISTS "Want_userId_expiresAt_idx" ON "public"."Want"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Want_userId_createdAt_idx" ON "public"."Want"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WantNote_userId_wantId_occurredAt_idx" ON "public"."WantNote"("userId", "wantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "WantNote_userId_createdAt_idx" ON "public"."WantNote"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Task_userId_wantId_idx" ON "public"."Task"("userId", "wantId");
CREATE INDEX IF NOT EXISTS "MarketLead_userId_wantId_idx" ON "public"."MarketLead"("userId", "wantId");

-- Copy existing WANT ExchangeItems into the new Want table. We keep ExchangeItem rows for rollback/read compatibility.
INSERT INTO "public"."Want" (
  "id", "userId", "wantType", "status", "titleEnc", "descriptionEnc", "summaryEnc", "criteriaEnc", "categoryEnc", "geographyEnc",
  "importance", "urgency", "timeHorizon", "confidence", "valueMinCents", "valueMaxCents", "currency", "reviewAt", "expiresAt",
  "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId", "exchangeItemId", "embedding_vec", "createdAt", "updatedAt"
)
SELECT
  'want_' || ei."id",
  ei."userId",
  CASE
    WHEN ei."categoryEnc" IS NOT NULL THEN 'ACQUISITION_CRITERIA'::"public"."WantType"
    ELSE 'GENERAL'::"public"."WantType"
  END,
  CASE ei."status"
    WHEN 'ACTIVE' THEN 'ACTIVE_MANDATE'::"public"."WantStatus"
    WHEN 'PAUSED' THEN 'WATCHING_MARKET'::"public"."WantStatus"
    WHEN 'FULFILLED' THEN 'MATCHED'::"public"."WantStatus"
    WHEN 'EXPIRED' THEN 'CLOSED_INACTIVE'::"public"."WantStatus"
    WHEN 'ARCHIVED' THEN 'ARCHIVED'::"public"."WantStatus"
    ELSE 'NEW'::"public"."WantStatus"
  END,
  ei."titleEnc", ei."descriptionEnc", ei."summaryEnc", NULL, ei."categoryEnc", ei."geographyEnc",
  ei."importance", ei."urgency", ei."timeHorizon", ei."confidence", ei."valueMinCents", ei."valueMaxCents", ei."currency", ei."reviewAt", ei."expiresAt",
  ei."contactId", ei."companyId", ei."dealId", ei."projectId", NULL, ei."companyContactId", ei."id", ei."embedding_vec", ei."createdAt", ei."updatedAt"
FROM "public"."ExchangeItem" ei
WHERE ei."type" = 'WANT'
  AND NOT EXISTS (SELECT 1 FROM "public"."Want" w WHERE w."exchangeItemId" = ei."id");

UPDATE "public"."MarketLead" ml
SET "wantId" = w."id"
FROM "public"."Want" w
WHERE ml."exchangeItemId" = w."exchangeItemId"
  AND ml."wantId" IS NULL;

-- Fold existing Company acquisition criteria into Want records so criteria does not remain a parallel concept.
INSERT INTO "public"."Want" (
  "id", "userId", "wantType", "status", "titleEnc", "criteriaEnc", "companyId", "importance", "urgency", "timeHorizon", "confidence", "createdAt", "updatedAt"
)
SELECT
  'company_criteria_' || c."id",
  c."userId",
  'ACQUISITION_CRITERIA'::"public"."WantType",
  'WATCHING_MARKET'::"public"."WantStatus",
  c."nameEnc",
  c."criteriaEnc",
  c."id",
  3,
  'NORMAL'::"public"."ExchangeUrgency",
  'ONGOING'::"public"."ExchangeTimeHorizon",
  'MEDIUM'::"public"."ExchangeConfidence",
  c."createdAt",
  c."updatedAt"
FROM "public"."Company" c
WHERE c."criteriaEnc" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."Want" w
    WHERE w."id" = 'company_criteria_' || c."id"
  );

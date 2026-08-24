-- Stage 7.3 - First-class Offers.
-- Offer becomes the supply-side working object for seller opportunities, available assets,
-- introductions, services, and things a person/company can make available.

DO $$ BEGIN
  CREATE TYPE "public"."OfferType" AS ENUM (
    'GENERAL',
    'SELLER_OPPORTUNITY',
    'AVAILABLE_ASSET',
    'INTRODUCTION',
    'SERVICE',
    'CAPITAL',
    'EXPERTISE',
    'REFERRAL',
    'PARTNERSHIP',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."OfferStatus" AS ENUM (
    'NEW',
    'CLARIFYING_SUPPLY',
    'AVAILABLE',
    'WATCHING_INTEREST',
    'MATCHED',
    'CONVERTED_TO_DEAL',
    'CLOSED_INACTIVE',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."Offer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "offerType" "public"."OfferType" NOT NULL DEFAULT 'GENERAL',
  "status" "public"."OfferStatus" NOT NULL DEFAULT 'NEW',
  "direction" "public"."ExchangeDirection" NOT NULL DEFAULT 'OFFERING',
  "titleEnc" TEXT NOT NULL,
  "descriptionEnc" TEXT,
  "summaryEnc" TEXT,
  "termsEnc" TEXT,
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
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."OfferNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL DEFAULT 'note',
  "bodyEnc" TEXT NOT NULL,
  "summaryEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfferNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Task" ADD COLUMN IF NOT EXISTS "offerId" TEXT;
ALTER TABLE "public"."MarketLead" ADD COLUMN IF NOT EXISTS "offerId" TEXT;

ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_userId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_contactId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_companyId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_dealId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_projectId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_workstreamId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "public"."ProjectWorkstream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_companyContactId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "public"."CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" DROP CONSTRAINT IF EXISTS "Offer_exchangeItemId_fkey";
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_exchangeItemId_fkey" FOREIGN KEY ("exchangeItemId") REFERENCES "public"."ExchangeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."OfferNote" DROP CONSTRAINT IF EXISTS "OfferNote_userId_fkey";
ALTER TABLE "public"."OfferNote" ADD CONSTRAINT "OfferNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."OfferNote" DROP CONSTRAINT IF EXISTS "OfferNote_offerId_fkey";
ALTER TABLE "public"."OfferNote" ADD CONSTRAINT "OfferNote_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Task" DROP CONSTRAINT IF EXISTS "Task_offerId_fkey";
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MarketLead" DROP CONSTRAINT IF EXISTS "MarketLead_offerId_fkey";
ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Offer_exchangeItemId_key" ON "public"."Offer"("exchangeItemId");
CREATE INDEX IF NOT EXISTS "Offer_userId_offerType_idx" ON "public"."Offer"("userId", "offerType");
CREATE INDEX IF NOT EXISTS "Offer_userId_status_idx" ON "public"."Offer"("userId", "status");
CREATE INDEX IF NOT EXISTS "Offer_userId_urgency_idx" ON "public"."Offer"("userId", "urgency");
CREATE INDEX IF NOT EXISTS "Offer_userId_timeHorizon_idx" ON "public"."Offer"("userId", "timeHorizon");
CREATE INDEX IF NOT EXISTS "Offer_userId_confidence_idx" ON "public"."Offer"("userId", "confidence");
CREATE INDEX IF NOT EXISTS "Offer_userId_contactId_idx" ON "public"."Offer"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "Offer_userId_companyId_idx" ON "public"."Offer"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "Offer_userId_dealId_idx" ON "public"."Offer"("userId", "dealId");
CREATE INDEX IF NOT EXISTS "Offer_userId_projectId_idx" ON "public"."Offer"("userId", "projectId");
CREATE INDEX IF NOT EXISTS "Offer_userId_workstreamId_idx" ON "public"."Offer"("userId", "workstreamId");
CREATE INDEX IF NOT EXISTS "Offer_userId_companyContactId_idx" ON "public"."Offer"("userId", "companyContactId");
CREATE INDEX IF NOT EXISTS "Offer_userId_reviewAt_idx" ON "public"."Offer"("userId", "reviewAt");
CREATE INDEX IF NOT EXISTS "Offer_userId_expiresAt_idx" ON "public"."Offer"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Offer_userId_createdAt_idx" ON "public"."Offer"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "OfferNote_userId_offerId_occurredAt_idx" ON "public"."OfferNote"("userId", "offerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "OfferNote_userId_createdAt_idx" ON "public"."OfferNote"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Task_userId_offerId_idx" ON "public"."Task"("userId", "offerId");
CREATE INDEX IF NOT EXISTS "MarketLead_userId_offerId_idx" ON "public"."MarketLead"("userId", "offerId");

-- Copy existing OFFER ExchangeItems into first-class Offer rows. We keep ExchangeItem rows for rollback/read compatibility.
INSERT INTO "public"."Offer" (
  "id", "userId", "offerType", "status", "direction", "titleEnc", "descriptionEnc", "summaryEnc", "termsEnc", "categoryEnc", "geographyEnc",
  "importance", "urgency", "timeHorizon", "confidence", "valueMinCents", "valueMaxCents", "currency", "reviewAt", "expiresAt",
  "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId", "exchangeItemId", "embedding_vec", "createdAt", "updatedAt"
)
SELECT
  'offer_' || ei."id",
  ei."userId",
  CASE
    WHEN ei."direction" = 'OFFERING' THEN 'GENERAL'::"public"."OfferType"
    WHEN ei."direction" = 'OPEN_TO' THEN 'SELLER_OPPORTUNITY'::"public"."OfferType"
    ELSE 'GENERAL'::"public"."OfferType"
  END,
  CASE ei."status"
    WHEN 'ACTIVE' THEN 'AVAILABLE'::"public"."OfferStatus"
    WHEN 'PAUSED' THEN 'WATCHING_INTEREST'::"public"."OfferStatus"
    WHEN 'FULFILLED' THEN 'MATCHED'::"public"."OfferStatus"
    WHEN 'EXPIRED' THEN 'CLOSED_INACTIVE'::"public"."OfferStatus"
    WHEN 'ARCHIVED' THEN 'ARCHIVED'::"public"."OfferStatus"
    ELSE 'NEW'::"public"."OfferStatus"
  END,
  ei."direction",
  ei."titleEnc", ei."descriptionEnc", ei."summaryEnc", NULL, ei."categoryEnc", ei."geographyEnc",
  ei."importance", ei."urgency", ei."timeHorizon", ei."confidence", ei."valueMinCents", ei."valueMaxCents", ei."currency", ei."reviewAt", ei."expiresAt",
  ei."contactId", ei."companyId", ei."dealId", ei."projectId", NULL, ei."companyContactId", ei."id", ei."embedding_vec", ei."createdAt", ei."updatedAt"
FROM "public"."ExchangeItem" ei
WHERE ei."type" = 'OFFER'
  AND NOT EXISTS (SELECT 1 FROM "public"."Offer" o WHERE o."exchangeItemId" = ei."id");

UPDATE "public"."MarketLead" ml
SET "offerId" = o."id"
FROM "public"."Offer" o
WHERE ml."exchangeItemId" = o."exchangeItemId"
  AND ml."offerId" IS NULL;

-- IT: Add wants/offers as embedded exchange items for contacts, companies, deals, and projects.
-- IT: The embedding vector is stored now so future matching/search can be added later.

CREATE TYPE "ExchangeItemType" AS ENUM ('WANT', 'OFFER');
CREATE TYPE "ExchangeUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'IMMEDIATE');
CREATE TYPE "ExchangeTimeHorizon" AS ENUM ('NOW', 'NEXT_30_DAYS', 'NEXT_90_DAYS', 'THIS_YEAR', 'LATER', 'ONGOING');
CREATE TYPE "ExchangeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FULFILLED', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "ExchangeConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ExchangeDirection" AS ENUM ('SEEKING', 'OFFERING', 'OPEN_TO', 'NOT_INTERESTED_IN', 'OTHER');

CREATE TABLE "ExchangeItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ExchangeItemType" NOT NULL,
  "direction" "ExchangeDirection" NOT NULL DEFAULT 'OTHER',
  "categoryEnc" TEXT,
  "titleEnc" TEXT NOT NULL,
  "descriptionEnc" TEXT,
  "summaryEnc" TEXT,
  "importance" INTEGER NOT NULL DEFAULT 3,
  "urgency" "ExchangeUrgency" NOT NULL DEFAULT 'NORMAL',
  "timeHorizon" "ExchangeTimeHorizon" NOT NULL DEFAULT 'ONGOING',
  "status" "ExchangeStatus" NOT NULL DEFAULT 'ACTIVE',
  "confidence" "ExchangeConfidence" NOT NULL DEFAULT 'MEDIUM',
  "geographyEnc" TEXT,
  "valueMinCents" INTEGER,
  "valueMaxCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "reviewAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "contactId" TEXT,
  "companyId" TEXT,
  "dealId" TEXT,
  "projectId" TEXT,
  "embedding_vec" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExchangeItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExchangeItem_userId_type_idx" ON "ExchangeItem"("userId", "type");
CREATE INDEX "ExchangeItem_userId_status_idx" ON "ExchangeItem"("userId", "status");
CREATE INDEX "ExchangeItem_userId_urgency_idx" ON "ExchangeItem"("userId", "urgency");
CREATE INDEX "ExchangeItem_userId_timeHorizon_idx" ON "ExchangeItem"("userId", "timeHorizon");
CREATE INDEX "ExchangeItem_userId_confidence_idx" ON "ExchangeItem"("userId", "confidence");
CREATE INDEX "ExchangeItem_userId_reviewAt_idx" ON "ExchangeItem"("userId", "reviewAt");
CREATE INDEX "ExchangeItem_userId_expiresAt_idx" ON "ExchangeItem"("userId", "expiresAt");
CREATE INDEX "ExchangeItem_userId_contactId_idx" ON "ExchangeItem"("userId", "contactId");
CREATE INDEX "ExchangeItem_userId_companyId_idx" ON "ExchangeItem"("userId", "companyId");
CREATE INDEX "ExchangeItem_userId_dealId_idx" ON "ExchangeItem"("userId", "dealId");
CREATE INDEX "ExchangeItem_userId_projectId_idx" ON "ExchangeItem"("userId", "projectId");

ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

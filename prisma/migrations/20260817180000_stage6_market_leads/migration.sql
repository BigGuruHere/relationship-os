-- Stage 6: Market Leads.
-- Adds a practical lead staging layer for market-making without replacing the
-- existing public claim Lead table.

CREATE TYPE "public"."CommunicationMethod" AS ENUM ('LINKEDIN', 'EMAIL', 'PHONE', 'SMS', 'WHATSAPP', 'IN_PERSON', 'OTHER', 'UNKNOWN');
CREATE TYPE "public"."MarketLeadType" AS ENUM ('BUYER', 'SELLER', 'COMPANY', 'CONTACT', 'MANDATE', 'ASSET', 'REFERRER', 'OTHER');
CREATE TYPE "public"."MarketLeadStatus" AS ENUM ('NEW', 'RESEARCHING', 'QUALIFIED', 'CONVERTED', 'NOT_RELEVANT', 'ARCHIVED');
CREATE TYPE "public"."MarketLeadSource" AS ENUM ('MANUAL', 'OUTREACH', 'REFERRAL', 'INBOUND', 'RESEARCH', 'IMPORTED', 'AI', 'OTHER');

ALTER TABLE "public"."Contact"
ADD COLUMN "usualCommunicationMethod" "public"."CommunicationMethod";

CREATE TABLE "public"."MarketLead" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "public"."MarketLeadType" NOT NULL DEFAULT 'OTHER',
  "status" "public"."MarketLeadStatus" NOT NULL DEFAULT 'NEW',
  "source" "public"."MarketLeadSource" NOT NULL DEFAULT 'MANUAL',
  "titleEnc" TEXT NOT NULL,
  "titleIdx" TEXT NOT NULL,
  "nameEnc" TEXT,
  "nameIdx" TEXT,
  "companyNameEnc" TEXT,
  "companyNameIdx" TEXT,
  "emailEnc" TEXT,
  "emailIdx" TEXT,
  "phoneEnc" TEXT,
  "phoneIdx" TEXT,
  "websiteEnc" TEXT,
  "websiteIdx" TEXT,
  "linkedinEnc" TEXT,
  "linkedinIdx" TEXT,
  "roleTitleEnc" TEXT,
  "geographyEnc" TEXT,
  "descriptionEnc" TEXT,
  "notesEnc" TEXT,
  "sourceUrlEnc" TEXT,
  "usualCommunicationMethod" "public"."CommunicationMethod",
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "priority" INTEGER NOT NULL DEFAULT 3,
  "valueMinCents" INTEGER,
  "valueMaxCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "nextActionEnc" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "contactId" TEXT,
  "companyId" TEXT,
  "dealId" TEXT,
  "projectId" TEXT,
  "exchangeItemId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketLead_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."MarketLead" ADD CONSTRAINT "MarketLead_exchangeItemId_fkey" FOREIGN KEY ("exchangeItemId") REFERENCES "public"."ExchangeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Contact_userId_usualCommunicationMethod_idx" ON "public"."Contact"("userId", "usualCommunicationMethod");
CREATE INDEX "MarketLead_userId_type_idx" ON "public"."MarketLead"("userId", "type");
CREATE INDEX "MarketLead_userId_status_idx" ON "public"."MarketLead"("userId", "status");
CREATE INDEX "MarketLead_userId_source_idx" ON "public"."MarketLead"("userId", "source");
CREATE INDEX "MarketLead_userId_priority_idx" ON "public"."MarketLead"("userId", "priority");
CREATE INDEX "MarketLead_userId_confidence_idx" ON "public"."MarketLead"("userId", "confidence");
CREATE INDEX "MarketLead_userId_usualCommunicationMethod_idx" ON "public"."MarketLead"("userId", "usualCommunicationMethod");
CREATE INDEX "MarketLead_userId_contactId_idx" ON "public"."MarketLead"("userId", "contactId");
CREATE INDEX "MarketLead_userId_companyId_idx" ON "public"."MarketLead"("userId", "companyId");
CREATE INDEX "MarketLead_userId_dealId_idx" ON "public"."MarketLead"("userId", "dealId");
CREATE INDEX "MarketLead_userId_projectId_idx" ON "public"."MarketLead"("userId", "projectId");
CREATE INDEX "MarketLead_userId_exchangeItemId_idx" ON "public"."MarketLead"("userId", "exchangeItemId");
CREATE INDEX "MarketLead_titleIdx_idx" ON "public"."MarketLead"("titleIdx");
CREATE INDEX "MarketLead_nameIdx_idx" ON "public"."MarketLead"("nameIdx");
CREATE INDEX "MarketLead_companyNameIdx_idx" ON "public"."MarketLead"("companyNameIdx");
CREATE INDEX "MarketLead_emailIdx_idx" ON "public"."MarketLead"("emailIdx");
CREATE INDEX "MarketLead_phoneIdx_idx" ON "public"."MarketLead"("phoneIdx");
CREATE INDEX "MarketLead_websiteIdx_idx" ON "public"."MarketLead"("websiteIdx");
CREATE INDEX "MarketLead_linkedinIdx_idx" ON "public"."MarketLead"("linkedinIdx");

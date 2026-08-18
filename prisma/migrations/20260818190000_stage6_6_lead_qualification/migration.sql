-- Stage 6.6 - Lead outreach and buyer/seller qualification
-- Keep these as TEXT rather than PostgreSQL enums so future status wording can evolve safely.
ALTER TABLE "public"."MarketLead"
  ADD COLUMN IF NOT EXISTS "contactAttemptStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
  ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "buyerStatus" TEXT NOT NULL DEFAULT 'NOT_ASKED',
  ADD COLUMN IF NOT EXISTS "sellerStatus" TEXT NOT NULL DEFAULT 'NOT_ASKED';

CREATE INDEX IF NOT EXISTS "MarketLead_userId_contactAttemptStatus_idx" ON "public"."MarketLead"("userId", "contactAttemptStatus");
CREATE INDEX IF NOT EXISTS "MarketLead_userId_buyerStatus_idx" ON "public"."MarketLead"("userId", "buyerStatus");
CREATE INDEX IF NOT EXISTS "MarketLead_userId_sellerStatus_idx" ON "public"."MarketLead"("userId", "sellerStatus");
CREATE INDEX IF NOT EXISTS "MarketLead_userId_lastContactedAt_idx" ON "public"."MarketLead"("userId", "lastContactedAt");

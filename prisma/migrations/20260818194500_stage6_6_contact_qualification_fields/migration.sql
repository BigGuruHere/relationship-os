-- Stage 6.6 follow-up: make ongoing lead qualification/origin fields available on Contact.
-- Converted leads remain as history, but contacts carry active relationship/outreach state.

ALTER TABLE "public"."Contact"
ADD COLUMN IF NOT EXISTS "source" "public"."MarketLeadSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS "leadSourceId" TEXT,
ADD COLUMN IF NOT EXISTS "addressEnc" TEXT,
ADD COLUMN IF NOT EXISTS "addressIdx" TEXT,
ADD COLUMN IF NOT EXISTS "contactAttemptStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
ADD COLUMN IF NOT EXISTS "buyerStatus" TEXT NOT NULL DEFAULT 'NOT_ASKED',
ADD COLUMN IF NOT EXISTS "sellerStatus" TEXT NOT NULL DEFAULT 'NOT_ASKED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Contact_leadSourceId_fkey'
  ) THEN
    ALTER TABLE "public"."Contact"
    ADD CONSTRAINT "Contact_leadSourceId_fkey"
    FOREIGN KEY ("leadSourceId") REFERENCES "public"."LeadSource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Contact_addressIdx_idx" ON "public"."Contact"("addressIdx");
CREATE INDEX IF NOT EXISTS "Contact_userId_source_idx" ON "public"."Contact"("userId", "source");
CREATE INDEX IF NOT EXISTS "Contact_userId_leadSourceId_idx" ON "public"."Contact"("userId", "leadSourceId");
CREATE INDEX IF NOT EXISTS "Contact_userId_contactAttemptStatus_idx" ON "public"."Contact"("userId", "contactAttemptStatus");
CREATE INDEX IF NOT EXISTS "Contact_userId_buyerStatus_idx" ON "public"."Contact"("userId", "buyerStatus");
CREATE INDEX IF NOT EXISTS "Contact_userId_sellerStatus_idx" ON "public"."Contact"("userId", "sellerStatus");

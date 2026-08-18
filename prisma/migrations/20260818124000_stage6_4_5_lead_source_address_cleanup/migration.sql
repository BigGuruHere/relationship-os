-- Stage 6.4/6.5 cleanup.
-- 1. Simplify MarketLead address to one encrypted field.
-- 2. Keep custom LeadSource as the reusable source table while the UI presents one source dropdown.
-- Existing address subfields are intentionally removed because they were not being used.
ALTER TABLE "public"."MarketLead"
  ADD COLUMN IF NOT EXISTS "addressEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "addressIdx" TEXT;

DROP INDEX IF EXISTS "public"."MarketLead_addressLine1Idx_idx";
DROP INDEX IF EXISTS "public"."MarketLead_postcodeIdx_idx";
CREATE INDEX IF NOT EXISTS "MarketLead_addressIdx_idx" ON "public"."MarketLead"("addressIdx");

ALTER TABLE "public"."MarketLead"
  DROP COLUMN IF EXISTS "addressLine1Enc",
  DROP COLUMN IF EXISTS "addressLine1Idx",
  DROP COLUMN IF EXISTS "addressLine2Enc",
  DROP COLUMN IF EXISTS "suburbEnc",
  DROP COLUMN IF EXISTS "stateEnc",
  DROP COLUMN IF EXISTS "postcodeEnc",
  DROP COLUMN IF EXISTS "postcodeIdx",
  DROP COLUMN IF EXISTS "countryEnc";

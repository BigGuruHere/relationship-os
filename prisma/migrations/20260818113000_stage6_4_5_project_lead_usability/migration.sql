-- Stage 6.4/6.5 project and lead usability.
CREATE TABLE IF NOT EXISTS "LeadSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nameEnc" TEXT NOT NULL,
  "nameIdx" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LeadSource"
  ADD CONSTRAINT "LeadSource_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "LeadSource_userId_nameIdx_key" ON "LeadSource"("userId", "nameIdx");
CREATE INDEX IF NOT EXISTS "LeadSource_userId_updatedAt_idx" ON "LeadSource"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "LeadSource_nameIdx_idx" ON "LeadSource"("nameIdx");

ALTER TABLE "MarketLead"
  ADD COLUMN IF NOT EXISTS "leadSourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine1Enc" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine1Idx" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2Enc" TEXT,
  ADD COLUMN IF NOT EXISTS "suburbEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "stateEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "postcodeEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "postcodeIdx" TEXT,
  ADD COLUMN IF NOT EXISTS "countryEnc" TEXT;

ALTER TABLE "MarketLead"
  ADD CONSTRAINT "MarketLead_leadSourceId_fkey"
  FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MarketLead_userId_leadSourceId_idx" ON "MarketLead"("userId", "leadSourceId");
CREATE INDEX IF NOT EXISTS "MarketLead_addressLine1Idx_idx" ON "MarketLead"("addressLine1Idx");
CREATE INDEX IF NOT EXISTS "MarketLead_postcodeIdx_idx" ON "MarketLead"("postcodeIdx");

ALTER TABLE "MarketLeadNote"
  ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'note';

CREATE INDEX IF NOT EXISTS "MarketLeadNote_userId_marketLeadId_occurredAt_idx" ON "MarketLeadNote"("userId", "marketLeadId", "occurredAt");

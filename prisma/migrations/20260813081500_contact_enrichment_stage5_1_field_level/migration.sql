-- Stage 5.1 - evidence-disciplined, field-level enrichment rows.
-- IT: Adds field-level metadata while keeping existing package-level rows compatible.

ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "groupKey" TEXT;
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "fieldKey" TEXT;
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "fieldLabel" TEXT;
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "proposedValueEnc" TEXT;
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "existingValueEnc" TEXT;
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "evidenceType" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "sourceKind" TEXT;
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "conflictStatus" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "ContactEnrichment" ADD COLUMN IF NOT EXISTS "isApplyable" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "ContactEnrichment_userId_fieldKey_idx" ON "ContactEnrichment"("userId", "fieldKey");
CREATE INDEX IF NOT EXISTS "ContactEnrichment_agentRunId_groupKey_idx" ON "ContactEnrichment"("agentRunId", "groupKey");
CREATE INDEX IF NOT EXISTS "ContactEnrichment_userId_conflictStatus_idx" ON "ContactEnrichment"("userId", "conflictStatus");

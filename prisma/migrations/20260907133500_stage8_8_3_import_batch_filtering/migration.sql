-- Stage 8.8.3 - separate operational import batches from ordinary lead sources.
-- Existing Stage 8.8 imported batches are identified from IMPORTED leads linked to a
-- CompanyExternalIdentifier. This is a one-time compatibility backfill for the importer
-- introduced in Stage 8.8; future imports set the kind explicitly in application code.

CREATE TYPE "LeadSourceKind" AS ENUM ('SOURCE', 'IMPORT_BATCH');

ALTER TABLE "LeadSource"
ADD COLUMN "kind" "LeadSourceKind" NOT NULL DEFAULT 'SOURCE';

UPDATE "LeadSource" AS ls
SET "kind" = 'IMPORT_BATCH'
WHERE EXISTS (
  SELECT 1
  FROM "MarketLead" AS ml
  INNER JOIN "CompanyExternalIdentifier" AS cei
    ON cei."companyId" = ml."companyId"
   AND cei."userId" = ml."userId"
   AND cei."contextSpaceId" = ml."contextSpaceId"
  WHERE ml."leadSourceId" = ls."id"
    AND ml."source" = 'IMPORTED'
);

CREATE INDEX "LeadSource_userId_contextSpaceId_kind_updatedAt_idx"
ON "LeadSource"("userId", "contextSpaceId", "kind", "updatedAt");

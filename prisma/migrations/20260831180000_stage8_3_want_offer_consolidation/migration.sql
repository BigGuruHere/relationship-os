-- Stage 8.3 - Want/Offer consolidation and ExchangeItem retirement.
-- DATA SAFETY: This migration first repairs and verifies all legacy ExchangeItem rows and provable links.
-- It aborts before destructive retirement if any legacy row or explicit dependent cannot be reconciled.
-- IT: Run atomically so a failed retirement gate leaves the pre-8.3 schema and data untouched.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Final repair pass while the legacy schema still exists.
-- ---------------------------------------------------------------------------
INSERT INTO "public"."Want" (
  "id", "userId", "wantType", "status", "titleEnc", "descriptionEnc", "summaryEnc", "criteriaEnc", "categoryEnc", "geographyEnc",
  "importance", "urgency", "timeHorizon", "confidence", "authority", "sourceType", "valueMinCents", "valueMaxCents", "currency", "reviewAt", "expiresAt",
  "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId", "exchangeItemId", "embedding_vec", "createdAt", "updatedAt"
)
SELECT
  'want_' || ei."id",
  ei."userId",
  CASE WHEN ei."categoryEnc" IS NOT NULL THEN 'ACQUISITION_CRITERIA'::"public"."WantType" ELSE 'GENERAL'::"public"."WantType" END,
  CASE ei."status"
    WHEN 'ACTIVE' THEN 'ACTIVE_MANDATE'::"public"."WantStatus"
    WHEN 'PAUSED' THEN 'WATCHING_MARKET'::"public"."WantStatus"
    WHEN 'FULFILLED' THEN 'MATCHED'::"public"."WantStatus"
    WHEN 'EXPIRED' THEN 'CLOSED_INACTIVE'::"public"."WantStatus"
    WHEN 'ARCHIVED' THEN 'ARCHIVED'::"public"."WantStatus"
    ELSE 'NEW'::"public"."WantStatus"
  END,
  ei."titleEnc", ei."descriptionEnc", ei."summaryEnc", NULL, ei."categoryEnc", ei."geographyEnc",
  ei."importance", ei."urgency", ei."timeHorizon", ei."confidence",
  'LEGACY_UNSPECIFIED'::"public"."KnowledgeAuthority", 'IMPORT'::"public"."KnowledgeSourceType",
  ei."valueMinCents", ei."valueMaxCents", ei."currency", ei."reviewAt", ei."expiresAt",
  ei."contactId", ei."companyId", ei."dealId", ei."projectId", NULL, ei."companyContactId", ei."id", ei."embedding_vec", ei."createdAt", ei."updatedAt"
FROM "public"."ExchangeItem" ei
WHERE ei."type" = 'WANT'
  AND NOT EXISTS (SELECT 1 FROM "public"."Want" w WHERE w."exchangeItemId" = ei."id")
ON CONFLICT DO NOTHING;

INSERT INTO "public"."Offer" (
  "id", "userId", "offerType", "status", "direction", "titleEnc", "descriptionEnc", "summaryEnc", "termsEnc", "categoryEnc", "geographyEnc",
  "importance", "urgency", "timeHorizon", "confidence", "authority", "sourceType", "valueMinCents", "valueMaxCents", "currency", "reviewAt", "expiresAt",
  "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId", "exchangeItemId", "embedding_vec", "createdAt", "updatedAt"
)
SELECT
  'offer_' || ei."id",
  ei."userId",
  CASE WHEN ei."direction" = 'OPEN_TO' THEN 'SELLER_OPPORTUNITY'::"public"."OfferType" ELSE 'GENERAL'::"public"."OfferType" END,
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
  ei."importance", ei."urgency", ei."timeHorizon", ei."confidence",
  'LEGACY_UNSPECIFIED'::"public"."KnowledgeAuthority", 'IMPORT'::"public"."KnowledgeSourceType",
  ei."valueMinCents", ei."valueMaxCents", ei."currency", ei."reviewAt", ei."expiresAt",
  ei."contactId", ei."companyId", ei."dealId", ei."projectId", NULL, ei."companyContactId", ei."id", ei."embedding_vec", ei."createdAt", ei."updatedAt"
FROM "public"."ExchangeItem" ei
WHERE ei."type" = 'OFFER'
  AND NOT EXISTS (SELECT 1 FROM "public"."Offer" o WHERE o."exchangeItemId" = ei."id")
ON CONFLICT DO NOTHING;

-- Reconcile legacy entity links only where the canonical row is currently null. Never overwrite a newer canonical link.
UPDATE "public"."Want" w
SET
  "contactId" = COALESCE(w."contactId", ei."contactId"),
  "companyId" = COALESCE(w."companyId", ei."companyId"),
  "dealId" = COALESCE(w."dealId", ei."dealId"),
  "projectId" = COALESCE(w."projectId", ei."projectId"),
  "companyContactId" = COALESCE(w."companyContactId", ei."companyContactId")
FROM "public"."ExchangeItem" ei
WHERE w."exchangeItemId" = ei."id" AND w."userId" = ei."userId";

UPDATE "public"."Offer" o
SET
  "contactId" = COALESCE(o."contactId", ei."contactId"),
  "companyId" = COALESCE(o."companyId", ei."companyId"),
  "dealId" = COALESCE(o."dealId", ei."dealId"),
  "projectId" = COALESCE(o."projectId", ei."projectId"),
  "companyContactId" = COALESCE(o."companyContactId", ei."companyContactId")
FROM "public"."ExchangeItem" ei
WHERE o."exchangeItemId" = ei."id" AND o."userId" = ei."userId";

-- MarketLead has an explicit legacy FK, so carry it to the first-class side before removing the FK.
UPDATE "public"."MarketLead" ml
SET "wantId" = w."id"
FROM "public"."Want" w
WHERE ml."exchangeItemId" = w."exchangeItemId"
  AND ml."userId" = w."userId"
  AND ml."wantId" IS NULL;

UPDATE "public"."MarketLead" ml
SET "offerId" = o."id"
FROM "public"."Offer" o
WHERE ml."exchangeItemId" = o."exchangeItemId"
  AND ml."userId" = o."userId"
  AND ml."offerId" IS NULL;

-- Generic Task provenance may still name ExchangeItem. Rewrite only explicit, provable references.
UPDATE "public"."Task" t
SET "sourceType" = 'Want', "sourceId" = w."id", "wantId" = COALESCE(t."wantId", w."id")
FROM "public"."Want" w
WHERE t."userId" = w."userId"
  AND t."sourceId" = w."exchangeItemId"
  AND lower(COALESCE(t."sourceType", '')) IN ('exchangeitem', 'exchange_item', 'exchange-item', 'exchange');

UPDATE "public"."Task" t
SET "sourceType" = 'Offer', "sourceId" = o."id", "offerId" = COALESCE(t."offerId", o."id")
FROM "public"."Offer" o
WHERE t."userId" = o."userId"
  AND t."sourceId" = o."exchangeItemId"
  AND lower(COALESCE(t."sourceType", '')) IN ('exchangeitem', 'exchange_item', 'exchange-item', 'exchange');

-- ---------------------------------------------------------------------------
-- 2. Hard verification gate. Destructive retirement does not run if anything remains unresolved.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_wants bigint;
  missing_offers bigint;
  unresolved_leads bigint;
  unresolved_tasks bigint;
BEGIN
  SELECT count(*) INTO missing_wants
  FROM "public"."ExchangeItem" ei
  WHERE ei."type" = 'WANT'
    AND NOT EXISTS (
      SELECT 1 FROM "public"."Want" w
      WHERE w."exchangeItemId" = ei."id" AND w."userId" = ei."userId"
    );

  SELECT count(*) INTO missing_offers
  FROM "public"."ExchangeItem" ei
  WHERE ei."type" = 'OFFER'
    AND NOT EXISTS (
      SELECT 1 FROM "public"."Offer" o
      WHERE o."exchangeItemId" = ei."id" AND o."userId" = ei."userId"
    );

  SELECT count(*) INTO unresolved_leads
  FROM "public"."MarketLead" ml
  JOIN "public"."ExchangeItem" ei ON ei."id" = ml."exchangeItemId"
  WHERE (ei."type" = 'WANT' AND ml."wantId" IS NULL)
     OR (ei."type" = 'OFFER' AND ml."offerId" IS NULL);

  SELECT count(*) INTO unresolved_tasks
  FROM "public"."Task" t
  WHERE lower(COALESCE(t."sourceType", '')) IN ('exchangeitem', 'exchange_item', 'exchange-item', 'exchange');

  RAISE NOTICE 'Stage 8.3 retirement gate: missing WANT=%, missing OFFER=%, unresolved lead links=%, unresolved task references=%',
    missing_wants, missing_offers, unresolved_leads, unresolved_tasks;

  IF missing_wants <> 0 OR missing_offers <> 0 OR unresolved_leads <> 0 OR unresolved_tasks <> 0 THEN
    RAISE EXCEPTION 'Stage 8.3 blocked ExchangeItem retirement: missing WANT %, missing OFFER %, unresolved leads %, unresolved tasks %',
      missing_wants, missing_offers, unresolved_leads, unresolved_tasks;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Generalise shared Want/Offer lifecycle and metadata enum names.
-- ---------------------------------------------------------------------------
CREATE TYPE "public"."IntentStatus" AS ENUM ('CAPTURED', 'CLARIFYING', 'ACTIVE', 'PAUSED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED', 'ARCHIVED');

ALTER TABLE "public"."Want" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Want" ALTER COLUMN "status" TYPE "public"."IntentStatus"
USING (
  CASE "status"::text
    WHEN 'NEW' THEN 'CAPTURED'
    WHEN 'CLARIFYING_CRITERIA' THEN 'CLARIFYING'
    WHEN 'ACTIVE_MANDATE' THEN 'ACTIVE'
    WHEN 'WATCHING_MARKET' THEN 'PAUSED'
    WHEN 'MATCHED' THEN 'FULFILLED'
    WHEN 'CONVERTED_TO_DEAL' THEN 'ACTIVE'
    WHEN 'CLOSED_INACTIVE' THEN CASE WHEN "expiresAt" IS NOT NULL AND "expiresAt" <= CURRENT_TIMESTAMP THEN 'EXPIRED' ELSE 'WITHDRAWN' END
    WHEN 'ARCHIVED' THEN 'ARCHIVED'
    ELSE 'CAPTURED'
  END
)::"public"."IntentStatus";
ALTER TABLE "public"."Want" ALTER COLUMN "status" SET DEFAULT 'CAPTURED';

ALTER TABLE "public"."Offer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Offer" ALTER COLUMN "status" TYPE "public"."IntentStatus"
USING (
  CASE "status"::text
    WHEN 'NEW' THEN 'CAPTURED'
    WHEN 'CLARIFYING_SUPPLY' THEN 'CLARIFYING'
    WHEN 'AVAILABLE' THEN 'ACTIVE'
    WHEN 'WATCHING_INTEREST' THEN 'PAUSED'
    WHEN 'MATCHED' THEN 'FULFILLED'
    WHEN 'CONVERTED_TO_DEAL' THEN 'ACTIVE'
    WHEN 'CLOSED_INACTIVE' THEN CASE WHEN "expiresAt" IS NOT NULL AND "expiresAt" <= CURRENT_TIMESTAMP THEN 'EXPIRED' ELSE 'WITHDRAWN' END
    WHEN 'ARCHIVED' THEN 'ARCHIVED'
    ELSE 'CAPTURED'
  END
)::"public"."IntentStatus";
ALTER TABLE "public"."Offer" ALTER COLUMN "status" SET DEFAULT 'CAPTURED';

DROP TYPE "public"."WantStatus";
DROP TYPE "public"."OfferStatus";

-- Rename the shared legacy enum types in place so stored values are preserved without rewriting data.
ALTER TYPE "public"."ExchangeUrgency" RENAME TO "IntentUrgency";
ALTER TYPE "public"."ExchangeTimeHorizon" RENAME TO "IntentTimeHorizon";
ALTER TYPE "public"."ExchangeConfidence" RENAME TO "IntentConfidence";
ALTER TYPE "public"."ExchangeDirection" RENAME TO "OfferDirection";

-- ---------------------------------------------------------------------------
-- 4. Retire the final legacy foreign keys/back-pointers and table.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."MarketLead" DROP COLUMN "exchangeItemId";
ALTER TABLE "public"."Want" DROP COLUMN "exchangeItemId";
ALTER TABLE "public"."Offer" DROP COLUMN "exchangeItemId";

DROP TABLE "public"."ExchangeItem";
DROP TYPE "public"."ExchangeItemType";
DROP TYPE "public"."ExchangeStatus";

COMMIT;

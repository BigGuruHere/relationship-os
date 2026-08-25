-- Stage 7.3.1 - First-class Wants/Offers integration repair and verification.
-- DATA SAFETY: This migration is forward-only and non-destructive. It never deletes legacy
-- ExchangeItem rows. It only inserts missing first-class copies and fills provable null links.

-- Repair any legacy WANT rows that did not get copied during Stage 7.3, for example after a
-- partially completed deploy. Deterministic ids and exchangeItemId uniqueness make this safe.
INSERT INTO "public"."Want" (
  "id", "userId", "wantType", "status", "titleEnc", "descriptionEnc", "summaryEnc", "criteriaEnc", "categoryEnc", "geographyEnc",
  "importance", "urgency", "timeHorizon", "confidence", "valueMinCents", "valueMaxCents", "currency", "reviewAt", "expiresAt",
  "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId", "exchangeItemId", "embedding_vec", "createdAt", "updatedAt"
)
SELECT
  'want_' || ei."id",
  ei."userId",
  CASE
    WHEN ei."categoryEnc" IS NOT NULL THEN 'ACQUISITION_CRITERIA'::"public"."WantType"
    ELSE 'GENERAL'::"public"."WantType"
  END,
  CASE ei."status"
    WHEN 'ACTIVE' THEN 'ACTIVE_MANDATE'::"public"."WantStatus"
    WHEN 'PAUSED' THEN 'WATCHING_MARKET'::"public"."WantStatus"
    WHEN 'FULFILLED' THEN 'MATCHED'::"public"."WantStatus"
    WHEN 'EXPIRED' THEN 'CLOSED_INACTIVE'::"public"."WantStatus"
    WHEN 'ARCHIVED' THEN 'ARCHIVED'::"public"."WantStatus"
    ELSE 'NEW'::"public"."WantStatus"
  END,
  ei."titleEnc", ei."descriptionEnc", ei."summaryEnc", NULL, ei."categoryEnc", ei."geographyEnc",
  ei."importance", ei."urgency", ei."timeHorizon", ei."confidence", ei."valueMinCents", ei."valueMaxCents", ei."currency", ei."reviewAt", ei."expiresAt",
  ei."contactId", ei."companyId", ei."dealId", ei."projectId", NULL, ei."companyContactId", ei."id", ei."embedding_vec", ei."createdAt", ei."updatedAt"
FROM "public"."ExchangeItem" ei
WHERE ei."type" = 'WANT'
  AND NOT EXISTS (SELECT 1 FROM "public"."Want" w WHERE w."exchangeItemId" = ei."id")
ON CONFLICT DO NOTHING;

-- Repair any legacy OFFER rows that did not get copied during Stage 7.3.
INSERT INTO "public"."Offer" (
  "id", "userId", "offerType", "status", "direction", "titleEnc", "descriptionEnc", "summaryEnc", "termsEnc", "categoryEnc", "geographyEnc",
  "importance", "urgency", "timeHorizon", "confidence", "valueMinCents", "valueMaxCents", "currency", "reviewAt", "expiresAt",
  "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId", "exchangeItemId", "embedding_vec", "createdAt", "updatedAt"
)
SELECT
  'offer_' || ei."id",
  ei."userId",
  CASE
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
  AND NOT EXISTS (SELECT 1 FROM "public"."Offer" o WHERE o."exchangeItemId" = ei."id")
ON CONFLICT DO NOTHING;

-- Repair Company acquisition-criteria copies if Stage 7.3 was interrupted after creating Want.
INSERT INTO "public"."Want" (
  "id", "userId", "wantType", "status", "titleEnc", "criteriaEnc", "companyId", "importance", "urgency", "timeHorizon", "confidence", "createdAt", "updatedAt"
)
SELECT
  'company_criteria_' || c."id",
  c."userId",
  'ACQUISITION_CRITERIA'::"public"."WantType",
  'WATCHING_MARKET'::"public"."WantStatus",
  c."nameEnc",
  c."criteriaEnc",
  c."id",
  3,
  'NORMAL'::"public"."ExchangeUrgency",
  'ONGOING'::"public"."ExchangeTimeHorizon",
  'MEDIUM'::"public"."ExchangeConfidence",
  c."createdAt",
  c."updatedAt"
FROM "public"."Company" c
WHERE c."criteriaEnc" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."Want" w
    WHERE w."id" = 'company_criteria_' || c."id"
  )
ON CONFLICT DO NOTHING;

-- MarketLead had an explicit ExchangeItem foreign key, so this association is provable and safe.
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

-- Task never had an ExchangeItem foreign key. However, Task has generic sourceType/sourceId fields.
-- If historical data explicitly says its source was an ExchangeItem, that is a provable link and can
-- be migrated safely. Tasks without that explicit provenance are intentionally left untouched.
UPDATE "public"."Task" t
SET "wantId" = w."id"
FROM "public"."Want" w
WHERE t."wantId" IS NULL
  AND t."userId" = w."userId"
  AND t."sourceId" = w."exchangeItemId"
  AND lower(COALESCE(t."sourceType", '')) IN ('exchangeitem', 'exchange_item', 'exchange-item', 'exchange');

UPDATE "public"."Task" t
SET "offerId" = o."id"
FROM "public"."Offer" o
WHERE t."offerId" IS NULL
  AND t."userId" = o."userId"
  AND t."sourceId" = o."exchangeItemId"
  AND lower(COALESCE(t."sourceType", '')) IN ('exchangeitem', 'exchange_item', 'exchange-item', 'exchange');

-- Deployment-log verification. These notices do not change data, but make it easy to confirm that
-- every legacy ExchangeItem has a first-class counterpart after the migration runs.
DO $$
DECLARE
  legacy_wants INTEGER;
  migrated_wants INTEGER;
  missing_wants INTEGER;
  legacy_offers INTEGER;
  migrated_offers INTEGER;
  missing_offers INTEGER;
  lead_want_links INTEGER;
  lead_offer_links INTEGER;
  explicit_task_want_links INTEGER;
  explicit_task_offer_links INTEGER;
BEGIN
  SELECT count(*) INTO legacy_wants FROM "public"."ExchangeItem" WHERE "type" = 'WANT';
  SELECT count(*) INTO migrated_wants FROM "public"."Want" WHERE "exchangeItemId" IS NOT NULL;
  SELECT count(*) INTO missing_wants
  FROM "public"."ExchangeItem" ei
  WHERE ei."type" = 'WANT'
    AND NOT EXISTS (SELECT 1 FROM "public"."Want" w WHERE w."exchangeItemId" = ei."id");

  SELECT count(*) INTO legacy_offers FROM "public"."ExchangeItem" WHERE "type" = 'OFFER';
  SELECT count(*) INTO migrated_offers FROM "public"."Offer" WHERE "exchangeItemId" IS NOT NULL;
  SELECT count(*) INTO missing_offers
  FROM "public"."ExchangeItem" ei
  WHERE ei."type" = 'OFFER'
    AND NOT EXISTS (SELECT 1 FROM "public"."Offer" o WHERE o."exchangeItemId" = ei."id");

  SELECT count(*) INTO lead_want_links FROM "public"."MarketLead" WHERE "wantId" IS NOT NULL;
  SELECT count(*) INTO lead_offer_links FROM "public"."MarketLead" WHERE "offerId" IS NOT NULL;
  SELECT count(*) INTO explicit_task_want_links FROM "public"."Task" WHERE "wantId" IS NOT NULL;
  SELECT count(*) INTO explicit_task_offer_links FROM "public"."Task" WHERE "offerId" IS NOT NULL;

  RAISE NOTICE 'Stage 7.3.1 verification: legacy WANT=%, migrated legacy WANT=%, missing WANT=%', legacy_wants, migrated_wants, missing_wants;
  RAISE NOTICE 'Stage 7.3.1 verification: legacy OFFER=%, migrated legacy OFFER=%, missing OFFER=%', legacy_offers, migrated_offers, missing_offers;
  RAISE NOTICE 'Stage 7.3.1 links: MarketLead wantId=%, offerId=%; Task wantId=%, offerId=%', lead_want_links, lead_offer_links, explicit_task_want_links, explicit_task_offer_links;

  IF missing_wants <> 0 OR missing_offers <> 0 THEN
    RAISE EXCEPTION 'Stage 7.3.1 verification failed: % WANT and % OFFER legacy rows remain unmigrated', missing_wants, missing_offers;
  END IF;
END $$;

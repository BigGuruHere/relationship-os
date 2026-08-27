-- Stage 7.3.4 - Commercial Values
-- IT: Widen all commercial-value columns from INTEGER to BIGINT so large M&A values are stored exactly.
-- Existing values are preserved. No rows or columns are dropped.

ALTER TABLE "Deal"
  ALTER COLUMN "valueCents" TYPE BIGINT USING "valueCents"::BIGINT;

ALTER TABLE "Want"
  ALTER COLUMN "valueMinCents" TYPE BIGINT USING "valueMinCents"::BIGINT,
  ALTER COLUMN "valueMaxCents" TYPE BIGINT USING "valueMaxCents"::BIGINT;

ALTER TABLE "Offer"
  ALTER COLUMN "valueMinCents" TYPE BIGINT USING "valueMinCents"::BIGINT,
  ALTER COLUMN "valueMaxCents" TYPE BIGINT USING "valueMaxCents"::BIGINT;

ALTER TABLE "ExchangeItem"
  ALTER COLUMN "valueMinCents" TYPE BIGINT USING "valueMinCents"::BIGINT,
  ALTER COLUMN "valueMaxCents" TYPE BIGINT USING "valueMaxCents"::BIGINT;

ALTER TABLE "MarketLead"
  ALTER COLUMN "valueMinCents" TYPE BIGINT USING "valueMinCents"::BIGINT,
  ALTER COLUMN "valueMaxCents" TYPE BIGINT USING "valueMaxCents"::BIGINT;

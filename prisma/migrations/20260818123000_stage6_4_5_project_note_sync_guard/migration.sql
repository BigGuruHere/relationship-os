-- Stage 6.4/6.5 guard migration.
-- IT: Some dev machines created these ProjectNote fields via a local sync migration.
-- These IF NOT EXISTS statements keep migration history portable without touching existing data.
ALTER TABLE "public"."ProjectNote"
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Stage 6.8 - Company notes and company-lead linking polish.
-- Adds dedicated company notes. MarketLead already has companyId, so lead linking is mainly UI/process code.

CREATE TABLE IF NOT EXISTS "public"."CompanyNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL DEFAULT 'note',
  "bodyEnc" TEXT NOT NULL,
  "summaryEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyNote_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyNote_userId_fkey') THEN
    ALTER TABLE "public"."CompanyNote"
      ADD CONSTRAINT "CompanyNote_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyNote_companyId_fkey') THEN
    ALTER TABLE "public"."CompanyNote"
      ADD CONSTRAINT "CompanyNote_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CompanyNote_userId_companyId_occurredAt_idx" ON "public"."CompanyNote"("userId", "companyId", "occurredAt");
CREATE INDEX IF NOT EXISTS "CompanyNote_userId_companyId_createdAt_idx" ON "public"."CompanyNote"("userId", "companyId", "createdAt");

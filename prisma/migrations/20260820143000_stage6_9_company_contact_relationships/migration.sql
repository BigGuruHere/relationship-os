-- Stage 6.9 - Contact-company relationships as first-class working records

CREATE TABLE IF NOT EXISTS "CompanyContactNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyContactId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL DEFAULT 'note',
  "bodyEnc" TEXT NOT NULL,
  "summaryEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyContactNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompanyContactNote"
  ADD CONSTRAINT "CompanyContactNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyContactNote"
  ADD CONSTRAINT "CompanyContactNote_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyContactNote"
  ADD CONSTRAINT "CompanyContactNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyContactNote"
  ADD CONSTRAINT "CompanyContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CompanyContactNote_userId_companyContactId_occurredAt_idx" ON "CompanyContactNote"("userId", "companyContactId", "occurredAt");
CREATE INDEX IF NOT EXISTS "CompanyContactNote_userId_companyId_occurredAt_idx" ON "CompanyContactNote"("userId", "companyId", "occurredAt");
CREATE INDEX IF NOT EXISTS "CompanyContactNote_userId_contactId_occurredAt_idx" ON "CompanyContactNote"("userId", "contactId", "occurredAt");

ALTER TABLE "DealContact" ADD COLUMN IF NOT EXISTS "companyContactId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "companyContactId" TEXT;
ALTER TABLE "ExchangeItem" ADD COLUMN IF NOT EXISTS "companyContactId" TEXT;

ALTER TABLE "DealContact" DROP CONSTRAINT IF EXISTS "DealContact_companyContactId_fkey";
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_companyContactId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExchangeItem" DROP CONSTRAINT IF EXISTS "ExchangeItem_companyContactId_fkey";
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "DealContact_userId_companyContactId_idx" ON "DealContact"("userId", "companyContactId");
CREATE INDEX IF NOT EXISTS "Task_userId_companyContactId_idx" ON "Task"("userId", "companyContactId");
CREATE INDEX IF NOT EXISTS "ExchangeItem_userId_companyContactId_idx" ON "ExchangeItem"("userId", "companyContactId");

-- Stage 6.1 - Lead workflow upgrade
-- Adds lead notes and lets tasks attach directly to MarketLead.

CREATE TABLE IF NOT EXISTS "MarketLeadNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketLeadId" TEXT NOT NULL,
    "bodyEnc" TEXT NOT NULL,
    "summaryEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketLeadNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MarketLeadNote" ADD CONSTRAINT "MarketLeadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketLeadNote" ADD CONSTRAINT "MarketLeadNote_marketLeadId_fkey" FOREIGN KEY ("marketLeadId") REFERENCES "MarketLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "marketLeadId" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_marketLeadId_fkey" FOREIGN KEY ("marketLeadId") REFERENCES "MarketLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MarketLeadNote_userId_marketLeadId_createdAt_idx" ON "MarketLeadNote"("userId", "marketLeadId", "createdAt");
CREATE INDEX IF NOT EXISTS "Task_userId_marketLeadId_idx" ON "Task"("userId", "marketLeadId");

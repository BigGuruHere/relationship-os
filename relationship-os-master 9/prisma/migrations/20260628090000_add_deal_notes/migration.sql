-- IT: Add notes and voice notes that belong directly to deals.
-- IT: A note can optionally be linked to a contact involved in the deal.
CREATE TABLE "DealNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "contactId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'note',
    "rawTextEnc" TEXT NOT NULL,
    "summaryEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealNote_userId_dealId_occurredAt_idx" ON "DealNote"("userId", "dealId", "occurredAt");
CREATE INDEX "DealNote_userId_contactId_occurredAt_idx" ON "DealNote"("userId", "contactId", "occurredAt");

ALTER TABLE "DealNote" ADD CONSTRAINT "DealNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealNote" ADD CONSTRAINT "DealNote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealNote" ADD CONSTRAINT "DealNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

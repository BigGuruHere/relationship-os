-- IT: Add relationship-driven deals and contact roles for each deal.
CREATE TYPE "DealStatus" AS ENUM ('DISCOVERY', 'QUALIFYING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'ON_HOLD');

CREATE TYPE "DealRelationshipType" AS ENUM ('DECISION_MAKER', 'CHAMPION', 'INFLUENCER', 'REFERRER', 'ADVISOR', 'BROKER', 'PARTNER', 'BUYER', 'SELLER', 'INVESTOR', 'SUPPLIER', 'CUSTOM');

CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleEnc" TEXT NOT NULL,
    "titleIdx" TEXT NOT NULL,
    "descriptionEnc" TEXT,
    "valueCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "status" "DealStatus" NOT NULL DEFAULT 'DISCOVERY',
    "probability" INTEGER,
    "expectedCloseDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lostReasonEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "relationshipType" "DealRelationshipType",
    "label" TEXT DEFAULT 'connected',
    "notesEnc" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Deal_userId_status_idx" ON "Deal"("userId", "status");
CREATE INDEX "Deal_userId_expectedCloseDate_idx" ON "Deal"("userId", "expectedCloseDate");
CREATE INDEX "Deal_userId_createdAt_idx" ON "Deal"("userId", "createdAt");
CREATE INDEX "Deal_titleIdx_idx" ON "Deal"("titleIdx");

CREATE UNIQUE INDEX "DealContact_dealId_contactId_label_key" ON "DealContact"("dealId", "contactId", "label");
CREATE INDEX "DealContact_userId_dealId_idx" ON "DealContact"("userId", "dealId");
CREATE INDEX "DealContact_userId_contactId_idx" ON "DealContact"("userId", "contactId");
CREATE INDEX "DealContact_userId_relationshipType_idx" ON "DealContact"("userId", "relationshipType");

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

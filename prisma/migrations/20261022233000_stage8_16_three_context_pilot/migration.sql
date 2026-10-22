-- Stage 8.16: additive profile publication, provisional browser continuity, entry provenance
-- and minimal first-party product intelligence. Existing profiles remain publicly visible.
ALTER TABLE "Profile" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PilotBrowserSession" (
  "id" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "visitorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PilotBrowserSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PilotBrowserSession_tokenHash_key" ON "PilotBrowserSession"("tokenHash");
CREATE INDEX "PilotBrowserSession_visitorUserId_expiresAt_idx" ON "PilotBrowserSession"("visitorUserId", "expiresAt");
ALTER TABLE "PilotBrowserSession" ADD CONSTRAINT "PilotBrowserSession_visitorUserId_fkey"
  FOREIGN KEY ("visitorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PilotProfileEntry" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "visitorUserId" TEXT NOT NULL,
  "domainKey" TEXT NOT NULL,
  "environment" VARCHAR(12) NOT NULL,
  "entrySource" TEXT NOT NULL DEFAULT 'link',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PilotProfileEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PilotProfileEntry_ownerUserId_domainKey_createdAt_idx" ON "PilotProfileEntry"("ownerUserId", "domainKey", "createdAt");
CREATE INDEX "PilotProfileEntry_visitorUserId_domainKey_createdAt_idx" ON "PilotProfileEntry"("visitorUserId", "domainKey", "createdAt");
CREATE INDEX "PilotProfileEntry_profileId_createdAt_idx" ON "PilotProfileEntry"("profileId", "createdAt");
ALTER TABLE "PilotProfileEntry" ADD CONSTRAINT "PilotProfileEntry_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NetworkDorianSession" ADD COLUMN "pilotEntryId" TEXT;
CREATE INDEX "NetworkDorianSession_pilotEntryId_idx" ON "NetworkDorianSession"("pilotEntryId");
ALTER TABLE "NetworkDorianSession" ADD CONSTRAINT "NetworkDorianSession_pilotEntryId_fkey"
  FOREIGN KEY ("pilotEntryId") REFERENCES "PilotProfileEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProductEvent" (
  "id" TEXT NOT NULL,
  "type" VARCHAR(90) NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "environment" VARCHAR(12) NOT NULL,
  "profileId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "domainKey" TEXT NOT NULL,
  "entryId" TEXT,
  "visitorUserId" TEXT,
  "conversationId" TEXT,
  "source" VARCHAR(24) NOT NULL DEFAULT 'link',
  "value" BOOLEAN,
  "idempotencyKey" VARCHAR(180),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductEvent_idempotencyKey_key" ON "ProductEvent"("idempotencyKey");
CREATE INDEX "ProductEvent_ownerUserId_domainKey_occurredAt_idx" ON "ProductEvent"("ownerUserId", "domainKey", "occurredAt");
CREATE INDEX "ProductEvent_entryId_occurredAt_idx" ON "ProductEvent"("entryId", "occurredAt");
CREATE INDEX "ProductEvent_profileId_type_occurredAt_idx" ON "ProductEvent"("profileId", "type", "occurredAt");
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "PilotProfileEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A named, explicit request to exchange only contact details, not private understanding.
CREATE TABLE "PilotConnectionRequest" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "visitorUserId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "domainKey" TEXT NOT NULL,
  "nameEnc" TEXT NOT NULL,
  "emailEnc" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PilotConnectionRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PilotConnectionRequest_entryId_key" ON "PilotConnectionRequest"("entryId");
CREATE INDEX "PilotConnectionRequest_ownerUserId_domainKey_createdAt_idx" ON "PilotConnectionRequest"("ownerUserId", "domainKey", "createdAt");
ALTER TABLE "PilotConnectionRequest" ADD CONSTRAINT "PilotConnectionRequest_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "PilotProfileEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

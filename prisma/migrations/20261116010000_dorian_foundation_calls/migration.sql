-- Only call and processing metadata belong here. Transcripts and LU use Foundation custody.
CREATE TYPE "DorianFoundationCallState" AS ENUM (
  'QUEUED', 'READY', 'NO_CHANGE', 'HELD', 'FAILED', 'INCOMPLETE', 'REVIEWED'
);
CREATE TABLE "DorianFoundationCall" (
  "id" TEXT PRIMARY KEY,
  "ownerUserId" TEXT NOT NULL,
  "vaultId" TEXT NOT NULL,
  "epoch" INTEGER NOT NULL,
  "subjectId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "consentVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease" TEXT,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "runKey" TEXT NOT NULL,
  "state" "DorianFoundationCallState" NOT NULL DEFAULT 'QUEUED',
  "sourceId" TEXT,
  "candidateId" TEXT,
  CONSTRAINT "DorianFoundationCall_ownerUserId_fkey" FOREIGN KEY ("ownerUserId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DorianFoundationCall_conversationId_key" ON "DorianFoundationCall" ("conversationId");
CREATE INDEX "DorianFoundationCall_state_nextAttemptAt_idx" ON "DorianFoundationCall" ("state", "nextAttemptAt");
CREATE INDEX "DorianFoundationCall_ownerUserId_createdAt_idx" ON "DorianFoundationCall" ("ownerUserId", "createdAt");

-- Stage 8.2 - Provenance + Minimal Introduction/Outcome
-- DATA SAFETY: Forward-only and non-destructive. Existing Wants/Offers remain intact.
-- Existing relationship intelligence is intentionally marked LEGACY_UNSPECIFIED rather than guessed.
-- No cross-workspace visibility, matching, or disclosure behaviour is introduced by this migration.

CREATE TYPE "KnowledgeAuthority" AS ENUM (
  'LEGACY_UNSPECIFIED',
  'SELF_DECLARED',
  'THIRD_PARTY_REPORTED',
  'WORKSPACE_RECORDED',
  'PUBLIC_SOURCE',
  'INFERRED',
  'SYSTEM_DERIVED'
);

CREATE TYPE "KnowledgeSourceType" AS ENUM (
  'MANUAL',
  'INTERACTION',
  'PUBLIC_RESEARCH',
  'AGENT',
  'IMPORT',
  'SYSTEM',
  'OTHER'
);

CREATE TYPE "IntroductionStatus" AS ENUM (
  'PLANNED',
  'PROPOSED',
  'INTRODUCED',
  'CONNECTED',
  'DECLINED',
  'CLOSED'
);

CREATE TYPE "IntroductionSide" AS ENUM ('A', 'B');

CREATE TYPE "OutcomeStatus" AS ENUM (
  'UNKNOWN',
  'NO_RESPONSE',
  'DECLINED',
  'CONNECTED',
  'CONTINUING',
  'SUCCESSFUL',
  'ENDED'
);

CREATE TYPE "OutcomeCommerciality" AS ENUM ('UNKNOWN', 'NON_COMMERCIAL', 'COMMERCIAL');

-- ---------------------------------------------------------------------------
-- Want / Offer provenance
-- ---------------------------------------------------------------------------
ALTER TABLE "Want"
  ADD COLUMN "authority" "KnowledgeAuthority" NOT NULL DEFAULT 'LEGACY_UNSPECIFIED',
  ADD COLUMN "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceInteractionId" TEXT,
  ADD COLUMN "sourceNoteEnc" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

ALTER TABLE "Offer"
  ADD COLUMN "authority" "KnowledgeAuthority" NOT NULL DEFAULT 'LEGACY_UNSPECIFIED',
  ADD COLUMN "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceInteractionId" TEXT,
  ADD COLUMN "sourceNoteEnc" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

CREATE INDEX "Want_userId_authority_idx" ON "Want"("userId", "authority");
CREATE INDEX "Want_userId_sourceType_idx" ON "Want"("userId", "sourceType");
CREATE INDEX "Want_userId_sourceInteractionId_idx" ON "Want"("userId", "sourceInteractionId");
CREATE INDEX "Offer_userId_authority_idx" ON "Offer"("userId", "authority");
CREATE INDEX "Offer_userId_sourceType_idx" ON "Offer"("userId", "sourceType");
CREATE INDEX "Offer_userId_sourceInteractionId_idx" ON "Offer"("userId", "sourceInteractionId");

ALTER TABLE "Want"
  ADD CONSTRAINT "Want_sourceInteractionId_fkey"
  FOREIGN KEY ("sourceInteractionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_sourceInteractionId_fkey"
  FOREIGN KEY ("sourceInteractionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Introduction
-- ---------------------------------------------------------------------------
CREATE TABLE "Introduction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "IntroductionStatus" NOT NULL DEFAULT 'INTRODUCED',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reasonEnc" TEXT,
  "notesEnc" TEXT,
  "evidenceEnc" TEXT,
  "authority" "KnowledgeAuthority" NOT NULL DEFAULT 'WORKSPACE_RECORDED',
  "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceInteractionId" TEXT,
  "facilitatorContactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Introduction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntroductionParticipant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "introductionId" TEXT NOT NULL,
  "side" "IntroductionSide" NOT NULL,
  "contactId" TEXT,
  "companyId" TEXT,
  "roleEnc" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntroductionParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntroductionParticipant_party_required" CHECK ("contactId" IS NOT NULL OR "companyId" IS NOT NULL)
);

CREATE UNIQUE INDEX "IntroductionParticipant_introductionId_side_key" ON "IntroductionParticipant"("introductionId", "side");
CREATE INDEX "IntroductionParticipant_userId_contactId_idx" ON "IntroductionParticipant"("userId", "contactId");
CREATE INDEX "IntroductionParticipant_userId_companyId_idx" ON "IntroductionParticipant"("userId", "companyId");
CREATE INDEX "Introduction_userId_status_idx" ON "Introduction"("userId", "status");
CREATE INDEX "Introduction_userId_occurredAt_idx" ON "Introduction"("userId", "occurredAt");
CREATE INDEX "Introduction_userId_authority_idx" ON "Introduction"("userId", "authority");
CREATE INDEX "Introduction_userId_sourceType_idx" ON "Introduction"("userId", "sourceType");
CREATE INDEX "Introduction_userId_sourceInteractionId_idx" ON "Introduction"("userId", "sourceInteractionId");
CREATE INDEX "Introduction_userId_facilitatorContactId_idx" ON "Introduction"("userId", "facilitatorContactId");

ALTER TABLE "Introduction"
  ADD CONSTRAINT "Introduction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Introduction"
  ADD CONSTRAINT "Introduction_sourceInteractionId_fkey"
  FOREIGN KEY ("sourceInteractionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Introduction"
  ADD CONSTRAINT "Introduction_facilitatorContactId_fkey"
  FOREIGN KEY ("facilitatorContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntroductionParticipant"
  ADD CONSTRAINT "IntroductionParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntroductionParticipant"
  ADD CONSTRAINT "IntroductionParticipant_introductionId_fkey"
  FOREIGN KEY ("introductionId") REFERENCES "Introduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntroductionParticipant"
  ADD CONSTRAINT "IntroductionParticipant_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntroductionParticipant"
  ADD CONSTRAINT "IntroductionParticipant_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Outcome - appendable evidence about an Introduction over time
-- ---------------------------------------------------------------------------
CREATE TABLE "Outcome" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "introductionId" TEXT NOT NULL,
  "status" "OutcomeStatus" NOT NULL DEFAULT 'UNKNOWN',
  "commerciality" "OutcomeCommerciality" NOT NULL DEFAULT 'UNKNOWN',
  "useful" BOOLEAN,
  "continued" BOOLEAN,
  "valueCents" BIGINT,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "resultEnc" TEXT,
  "notesEnc" TEXT,
  "evidenceEnc" TEXT,
  "authority" "KnowledgeAuthority" NOT NULL DEFAULT 'WORKSPACE_RECORDED',
  "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceInteractionId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Outcome_userId_introductionId_occurredAt_idx" ON "Outcome"("userId", "introductionId", "occurredAt");
CREATE INDEX "Outcome_userId_status_idx" ON "Outcome"("userId", "status");
CREATE INDEX "Outcome_userId_commerciality_idx" ON "Outcome"("userId", "commerciality");
CREATE INDEX "Outcome_userId_authority_idx" ON "Outcome"("userId", "authority");
CREATE INDEX "Outcome_userId_sourceType_idx" ON "Outcome"("userId", "sourceType");
CREATE INDEX "Outcome_userId_sourceInteractionId_idx" ON "Outcome"("userId", "sourceInteractionId");

ALTER TABLE "Outcome"
  ADD CONSTRAINT "Outcome_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outcome"
  ADD CONSTRAINT "Outcome_introductionId_fkey"
  FOREIGN KEY ("introductionId") REFERENCES "Introduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outcome"
  ADD CONSTRAINT "Outcome_sourceInteractionId_fkey"
  FOREIGN KEY ("sourceInteractionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

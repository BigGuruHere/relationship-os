-- Stage 8.4 - Common Interaction + Knowledge pipeline
-- DATA SAFETY: Forward-only additive migration. No rows/tables are deleted.
-- Existing Interaction rows remain intact; contactId simply becomes optional for future channel-neutral ingestion.

BEGIN;

CREATE TYPE "public"."InteractionSourceType" AS ENUM (
  'WORKSPACE',
  'AGENT',
  'EMAIL_CONNECTOR',
  'CALENDAR_CONNECTOR',
  'IMPORT',
  'API',
  'SYSTEM',
  'OTHER'
);

CREATE TYPE "public"."KnowledgeClaimKind" AS ENUM (
  'FACT',
  'OBJECTIVE',
  'WANT',
  'OFFER',
  'PREFERENCE',
  'CONSTRAINT',
  'RELATIONSHIP_STATE',
  'OTHER'
);

CREATE TYPE "public"."KnowledgeClaimStatus" AS ENUM (
  'ACTIVE',
  'SUPERSEDED',
  'REJECTED'
);

CREATE TYPE "public"."KnowledgeConfidence" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

ALTER TABLE "public"."Interaction"
  ADD COLUMN "sourceType" "public"."InteractionSourceType" NOT NULL DEFAULT 'WORKSPACE',
  ADD COLUMN "externalRef" TEXT,
  ADD COLUMN "personId" TEXT,
  ADD COLUMN "companyId" TEXT;

-- IT: Existing Contact interactions inherit the canonical Person identity only where Stage 8.1 already established it.
UPDATE "public"."Interaction" i
SET "personId" = c."personId"
FROM "public"."Contact" c
WHERE i."contactId" = c."id"
  AND i."userId" = c."userId"
  AND c."personId" IS NOT NULL
  AND i."personId" IS NULL;

-- IT: Future agent/connector interactions may be attached to Person/Company without requiring a Workspace Contact.
ALTER TABLE "public"."Interaction" ALTER COLUMN "contactId" DROP NOT NULL;

ALTER TABLE "public"."Interaction"
  ADD CONSTRAINT "Interaction_subject_required" CHECK ("contactId" IS NOT NULL OR "personId" IS NOT NULL OR "companyId" IS NOT NULL);

ALTER TABLE "public"."Interaction"
  ADD CONSTRAINT "Interaction_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Interaction_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Interaction_userId_contactId_idx" ON "public"."Interaction"("userId", "contactId");
CREATE INDEX "Interaction_userId_personId_idx" ON "public"."Interaction"("userId", "personId");
CREATE INDEX "Interaction_userId_companyId_idx" ON "public"."Interaction"("userId", "companyId");
CREATE INDEX "Interaction_userId_sourceType_occurredAt_idx" ON "public"."Interaction"("userId", "sourceType", "occurredAt");
CREATE UNIQUE INDEX "Interaction_userId_sourceType_externalRef_key" ON "public"."Interaction"("userId", "sourceType", "externalRef");

-- IT: Wants/Offers gain canonical Person subject continuity without changing workspace custody.
ALTER TABLE "public"."Want" ADD COLUMN "personId" TEXT;
ALTER TABLE "public"."Offer" ADD COLUMN "personId" TEXT;

UPDATE "public"."Want" w
SET "personId" = c."personId"
FROM "public"."Contact" c
WHERE w."contactId" = c."id" AND w."userId" = c."userId" AND c."personId" IS NOT NULL AND w."personId" IS NULL;

UPDATE "public"."Offer" o
SET "personId" = c."personId"
FROM "public"."Contact" c
WHERE o."contactId" = c."id" AND o."userId" = c."userId" AND c."personId" IS NOT NULL AND o."personId" IS NULL;

ALTER TABLE "public"."Want"
  ADD CONSTRAINT "Want_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Offer"
  ADD CONSTRAINT "Offer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Want_userId_personId_idx" ON "public"."Want"("userId", "personId");
CREATE INDEX "Offer_userId_personId_idx" ON "public"."Offer"("userId", "personId");

CREATE TABLE "public"."Objective" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "public"."IntentStatus" NOT NULL DEFAULT 'CAPTURED',
  "titleEnc" TEXT NOT NULL,
  "descriptionEnc" TEXT,
  "importance" INTEGER NOT NULL DEFAULT 3,
  "confidence" "public"."IntentConfidence" NOT NULL DEFAULT 'MEDIUM',
  "authority" "public"."KnowledgeAuthority" NOT NULL DEFAULT 'THIRD_PARTY_REPORTED',
  "sourceType" "public"."KnowledgeSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceInteractionId" TEXT,
  "sourceNoteEnc" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "contactId" TEXT,
  "personId" TEXT,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."KnowledgeClaim" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "public"."KnowledgeClaimKind" NOT NULL,
  "status" "public"."KnowledgeClaimStatus" NOT NULL DEFAULT 'ACTIVE',
  "statementEnc" TEXT NOT NULL,
  "statementIdx" TEXT NOT NULL,
  "authority" "public"."KnowledgeAuthority" NOT NULL DEFAULT 'WORKSPACE_RECORDED',
  "confidence" "public"."KnowledgeConfidence" NOT NULL DEFAULT 'MEDIUM',
  "contactId" TEXT,
  "personId" TEXT,
  "companyId" TEXT,
  "objectiveId" TEXT,
  "wantId" TEXT,
  "offerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."KnowledgeEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "sourceInteractionId" TEXT,
  "sourceType" "public"."KnowledgeSourceType" NOT NULL DEFAULT 'INTERACTION',
  "authority" "public"."KnowledgeAuthority" NOT NULL DEFAULT 'WORKSPACE_RECORDED',
  "confidence" "public"."KnowledgeConfidence" NOT NULL DEFAULT 'MEDIUM',
  "noteEnc" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeEvidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Objective"
  ADD CONSTRAINT "Objective_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Objective_sourceInteractionId_fkey" FOREIGN KEY ("sourceInteractionId") REFERENCES "public"."Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Objective_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Objective_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Objective_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."KnowledgeClaim"
  ADD CONSTRAINT "KnowledgeClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeClaim_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeClaim_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeClaim_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "public"."Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeClaim_wantId_fkey" FOREIGN KEY ("wantId") REFERENCES "public"."Want"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeClaim_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Objective"
  ADD CONSTRAINT "Objective_subject_required" CHECK ("contactId" IS NOT NULL OR "personId" IS NOT NULL OR "companyId" IS NOT NULL);

ALTER TABLE "public"."KnowledgeClaim"
  ADD CONSTRAINT "KnowledgeClaim_subject_required" CHECK ("contactId" IS NOT NULL OR "personId" IS NOT NULL OR "companyId" IS NOT NULL),
  ADD CONSTRAINT "KnowledgeClaim_one_structured_target" CHECK (num_nonnulls("objectiveId", "wantId", "offerId") <= 1);

ALTER TABLE "public"."KnowledgeEvidence"
  ADD CONSTRAINT "KnowledgeEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."KnowledgeClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "KnowledgeEvidence_sourceInteractionId_fkey" FOREIGN KEY ("sourceInteractionId") REFERENCES "public"."Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Objective_userId_status_idx" ON "public"."Objective"("userId", "status");
CREATE INDEX "Objective_userId_contactId_idx" ON "public"."Objective"("userId", "contactId");
CREATE INDEX "Objective_userId_personId_idx" ON "public"."Objective"("userId", "personId");
CREATE INDEX "Objective_userId_companyId_idx" ON "public"."Objective"("userId", "companyId");
CREATE INDEX "Objective_userId_sourceInteractionId_idx" ON "public"."Objective"("userId", "sourceInteractionId");
CREATE INDEX "Objective_userId_updatedAt_idx" ON "public"."Objective"("userId", "updatedAt");

CREATE INDEX "KnowledgeClaim_userId_kind_status_idx" ON "public"."KnowledgeClaim"("userId", "kind", "status");
CREATE INDEX "KnowledgeClaim_userId_statementIdx_idx" ON "public"."KnowledgeClaim"("userId", "statementIdx");
CREATE INDEX "KnowledgeClaim_userId_contactId_idx" ON "public"."KnowledgeClaim"("userId", "contactId");
CREATE INDEX "KnowledgeClaim_userId_personId_idx" ON "public"."KnowledgeClaim"("userId", "personId");
CREATE INDEX "KnowledgeClaim_userId_companyId_idx" ON "public"."KnowledgeClaim"("userId", "companyId");
CREATE INDEX "KnowledgeClaim_userId_objectiveId_idx" ON "public"."KnowledgeClaim"("userId", "objectiveId");
CREATE INDEX "KnowledgeClaim_userId_wantId_idx" ON "public"."KnowledgeClaim"("userId", "wantId");
CREATE INDEX "KnowledgeClaim_userId_offerId_idx" ON "public"."KnowledgeClaim"("userId", "offerId");

CREATE INDEX "KnowledgeEvidence_userId_claimId_idx" ON "public"."KnowledgeEvidence"("userId", "claimId");
CREATE INDEX "KnowledgeEvidence_userId_sourceInteractionId_idx" ON "public"."KnowledgeEvidence"("userId", "sourceInteractionId");
CREATE INDEX "KnowledgeEvidence_userId_sourceType_idx" ON "public"."KnowledgeEvidence"("userId", "sourceType");
CREATE UNIQUE INDEX "KnowledgeEvidence_claimId_sourceInteractionId_key" ON "public"."KnowledgeEvidence"("claimId", "sourceInteractionId");

COMMIT;

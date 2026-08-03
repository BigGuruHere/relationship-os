-- Stage 3 - live research evidence/source logging for agent framework.
-- IT: This keeps web/search evidence separate from source-of-truth CRM records.

DO $$ BEGIN
  CREATE TYPE "ResearchSourceType" AS ENUM ('SEARCH_RESULT', 'WEB_PAGE', 'USER_SOURCE', 'EXTRACTED_PROFILE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ResearchSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "researchCandidateId" TEXT,
  "companyId" TEXT,
  "contactId" TEXT,
  "sourceType" "ResearchSourceType" NOT NULL DEFAULT 'SEARCH_RESULT',
  "provider" TEXT NOT NULL DEFAULT 'manual',
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "queryEnc" TEXT,
  "titleEnc" TEXT,
  "urlEnc" TEXT,
  "snippetEnc" TEXT,
  "contentEnc" TEXT,
  "evidenceJson" JSONB,
  "fetchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ResearchSource"
  ADD CONSTRAINT "ResearchSource_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchSource"
  ADD CONSTRAINT "ResearchSource_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchSource"
  ADD CONSTRAINT "ResearchSource_researchCandidateId_fkey"
  FOREIGN KEY ("researchCandidateId") REFERENCES "ResearchCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchSource"
  ADD CONSTRAINT "ResearchSource_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchSource"
  ADD CONSTRAINT "ResearchSource_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ResearchSource_userId_sourceType_idx" ON "ResearchSource"("userId", "sourceType");
CREATE INDEX IF NOT EXISTS "ResearchSource_userId_provider_idx" ON "ResearchSource"("userId", "provider");
CREATE INDEX IF NOT EXISTS "ResearchSource_userId_companyId_idx" ON "ResearchSource"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "ResearchSource_userId_contactId_idx" ON "ResearchSource"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "ResearchSource_userId_researchCandidateId_idx" ON "ResearchSource"("userId", "researchCandidateId");
CREATE INDEX IF NOT EXISTS "ResearchSource_agentRunId_idx" ON "ResearchSource"("agentRunId");

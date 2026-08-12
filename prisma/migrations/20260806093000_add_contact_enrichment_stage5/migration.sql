-- Stage 5 - Contact Enrichment staging.
-- IT: Proposed contact details are reviewed before they update source-of-truth CRM records.

CREATE TABLE IF NOT EXISTS "ContactEnrichment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "researchCandidateId" TEXT,
  "companyId" TEXT,
  "contactId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "targetNameEnc" TEXT,
  "fullNameEnc" TEXT,
  "emailEnc" TEXT,
  "phoneEnc" TEXT,
  "linkedinEnc" TEXT,
  "companyNameEnc" TEXT,
  "roleTitleEnc" TEXT,
  "websiteEnc" TEXT,
  "sourceUrlEnc" TEXT,
  "sourceLabelEnc" TEXT,
  "evidenceEnc" TEXT,
  "notesEnc" TEXT,
  "structuredJson" JSONB,
  "appliedAt" TIMESTAMP(3),
  "appliedEntityType" TEXT,
  "appliedEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactEnrichment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ContactEnrichment"
  ADD CONSTRAINT "ContactEnrichment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactEnrichment"
  ADD CONSTRAINT "ContactEnrichment_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactEnrichment"
  ADD CONSTRAINT "ContactEnrichment_researchCandidateId_fkey"
  FOREIGN KEY ("researchCandidateId") REFERENCES "ResearchCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactEnrichment"
  ADD CONSTRAINT "ContactEnrichment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactEnrichment"
  ADD CONSTRAINT "ContactEnrichment_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ContactEnrichment_userId_status_idx" ON "ContactEnrichment"("userId", "status");
CREATE INDEX IF NOT EXISTS "ContactEnrichment_userId_contactId_idx" ON "ContactEnrichment"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "ContactEnrichment_userId_companyId_idx" ON "ContactEnrichment"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "ContactEnrichment_userId_researchCandidateId_idx" ON "ContactEnrichment"("userId", "researchCandidateId");
CREATE INDEX IF NOT EXISTS "ContactEnrichment_agentRunId_idx" ON "ContactEnrichment"("agentRunId");

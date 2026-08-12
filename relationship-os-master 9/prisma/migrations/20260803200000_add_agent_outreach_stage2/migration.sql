-- IT: Stage 2 Outreach Agent foundation.
-- IT: Adds candidate staging and opportunity scores so AI research can be reviewed before it becomes source-of-truth CRM data.

CREATE TYPE "ResearchCandidateEntityType" AS ENUM ('COMPANY', 'CONTACT');
CREATE TYPE "ResearchCandidateStatus" AS ENUM ('CANDIDATE', 'APPROVED', 'REJECTED', 'IMPORTED');

CREATE TABLE "ResearchCandidate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "entityType" "ResearchCandidateEntityType" NOT NULL DEFAULT 'COMPANY',
  "status" "ResearchCandidateStatus" NOT NULL DEFAULT 'CANDIDATE',
  "nameEnc" TEXT NOT NULL,
  "nameIdx" TEXT NOT NULL,
  "websiteEnc" TEXT,
  "websiteIdx" TEXT,
  "sourceUrlEnc" TEXT,
  "sourceLabelEnc" TEXT,
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "structuredJson" JSONB,
  "notesEnc" TEXT,
  "createdEntityType" TEXT,
  "createdEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpportunityScore" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "researchCandidateId" TEXT,
  "companyId" TEXT,
  "contactId" TEXT,
  "dealId" TEXT,
  "totalScore" INTEGER NOT NULL DEFAULT 0,
  "sectorFitScore" INTEGER,
  "ownerLedScore" INTEGER,
  "dealLikelihoodScore" INTEGER,
  "outreachFitScore" INTEGER,
  "timingScore" INTEGER,
  "confidenceScore" INTEGER,
  "rationaleJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchCandidate_userId_status_idx" ON "ResearchCandidate"("userId", "status");
CREATE INDEX "ResearchCandidate_userId_entityType_idx" ON "ResearchCandidate"("userId", "entityType");
CREATE INDEX "ResearchCandidate_userId_nameIdx_idx" ON "ResearchCandidate"("userId", "nameIdx");
CREATE INDEX "ResearchCandidate_agentRunId_idx" ON "ResearchCandidate"("agentRunId");

CREATE INDEX "OpportunityScore_userId_totalScore_idx" ON "OpportunityScore"("userId", "totalScore");
CREATE INDEX "OpportunityScore_userId_companyId_idx" ON "OpportunityScore"("userId", "companyId");
CREATE INDEX "OpportunityScore_userId_contactId_idx" ON "OpportunityScore"("userId", "contactId");
CREATE INDEX "OpportunityScore_userId_dealId_idx" ON "OpportunityScore"("userId", "dealId");
CREATE INDEX "OpportunityScore_userId_researchCandidateId_idx" ON "OpportunityScore"("userId", "researchCandidateId");
CREATE INDEX "OpportunityScore_agentRunId_idx" ON "OpportunityScore"("agentRunId");

ALTER TABLE "ResearchCandidate" ADD CONSTRAINT "ResearchCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCandidate" ADD CONSTRAINT "ResearchCandidate_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_researchCandidateId_fkey" FOREIGN KEY ("researchCandidateId") REFERENCES "ResearchCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

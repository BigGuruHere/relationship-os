-- Stage 4 - Opportunity Scoring v2.
-- IT: Adds explainable scorecards and score factors without automating outreach or imports.

ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "scoreVersion" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "scoreLabel" TEXT NOT NULL DEFAULT 'watch';
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "recommendedAction" TEXT;
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "strategicFitScore" INTEGER;
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "valuePotentialScore" INTEGER;
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "relationshipPathScore" INTEGER;
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "evidenceQualityScore" INTEGER;
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "riskScore" INTEGER;
ALTER TABLE "OpportunityScore" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "OpportunityScoreFactor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "opportunityScoreId" TEXT NOT NULL,
  "researchCandidateId" TEXT,
  "companyId" TEXT,
  "contactId" TEXT,
  "dealId" TEXT,
  "criterionKey" TEXT NOT NULL,
  "criterionLabel" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "polarity" TEXT NOT NULL DEFAULT 'positive',
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "evidenceEnc" TEXT,
  "rationaleEnc" TEXT,
  "sourceUrlEnc" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityScoreFactor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OpportunityScoreFactor" ADD CONSTRAINT "OpportunityScoreFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityScoreFactor" ADD CONSTRAINT "OpportunityScoreFactor_opportunityScoreId_fkey" FOREIGN KEY ("opportunityScoreId") REFERENCES "OpportunityScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityScoreFactor" ADD CONSTRAINT "OpportunityScoreFactor_researchCandidateId_fkey" FOREIGN KEY ("researchCandidateId") REFERENCES "ResearchCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityScoreFactor" ADD CONSTRAINT "OpportunityScoreFactor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityScoreFactor" ADD CONSTRAINT "OpportunityScoreFactor_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityScoreFactor" ADD CONSTRAINT "OpportunityScoreFactor_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "OpportunityScore_userId_scoreLabel_idx" ON "OpportunityScore"("userId", "scoreLabel");
CREATE INDEX IF NOT EXISTS "OpportunityScore_userId_priority_idx" ON "OpportunityScore"("userId", "priority");
CREATE INDEX IF NOT EXISTS "OpportunityScoreFactor_userId_criterionKey_idx" ON "OpportunityScoreFactor"("userId", "criterionKey");
CREATE INDEX IF NOT EXISTS "OpportunityScoreFactor_userId_opportunityScoreId_idx" ON "OpportunityScoreFactor"("userId", "opportunityScoreId");
CREATE INDEX IF NOT EXISTS "OpportunityScoreFactor_userId_researchCandidateId_idx" ON "OpportunityScoreFactor"("userId", "researchCandidateId");
CREATE INDEX IF NOT EXISTS "OpportunityScoreFactor_userId_companyId_idx" ON "OpportunityScoreFactor"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "OpportunityScoreFactor_userId_contactId_idx" ON "OpportunityScoreFactor"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "OpportunityScoreFactor_userId_dealId_idx" ON "OpportunityScoreFactor"("userId", "dealId");

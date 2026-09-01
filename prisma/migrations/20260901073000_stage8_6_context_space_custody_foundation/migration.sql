-- Stage 8.6 - ContextSpace Custody Foundation
-- Safe forward migration: additive custody columns, guards, and backfill only.
BEGIN;

CREATE TYPE "ContextSpaceKind" AS ENUM ('WORKSPACE', 'AGENT_RELATIONSHIP', 'OTHER');

CREATE TABLE "ContextSpace" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "kind" "ContextSpaceKind" NOT NULL DEFAULT 'WORKSPACE',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContextSpace_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ContextSpace" ADD CONSTRAINT "ContextSpace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ContextSpace_ownerUserId_idx" ON "ContextSpace"("ownerUserId");
CREATE INDEX "ContextSpace_ownerUserId_kind_idx" ON "ContextSpace"("ownerUserId", "kind");

INSERT INTO "ContextSpace" ("id", "ownerUserId", "kind", "isDefault", "createdAt", "updatedAt")
SELECT "id", "id", 'WORKSPACE'::"ContextSpaceKind", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("id") DO NOTHING;

CREATE OR REPLACE FUNCTION "relish_enforce_single_default_context"() RETURNS trigger AS $$
BEGIN
  IF NEW."isDefault" AND EXISTS (
    SELECT 1 FROM "ContextSpace" c
    WHERE c."ownerUserId" = NEW."ownerUserId" AND c."isDefault" = true AND c."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION 'Only one default ContextSpace is allowed per owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ContextSpace_single_default_guard"
BEFORE INSERT OR UPDATE OF "ownerUserId", "isDefault" ON "ContextSpace"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_single_default_context"();

CREATE OR REPLACE FUNCTION "relish_create_default_context_for_user"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "ContextSpace" ("id", "ownerUserId", "kind", "isDefault", "createdAt", "updatedAt")
  VALUES (NEW."id", NEW."id", 'WORKSPACE'::"ContextSpaceKind", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "User_create_default_context_space"
AFTER INSERT ON "User"
FOR EACH ROW EXECUTE FUNCTION "relish_create_default_context_for_user"();

ALTER TABLE "Contact" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Contact" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Contact" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Contact_userId_contextSpaceId_idx" ON "Contact"("userId", "contextSpaceId");

ALTER TABLE "Interaction" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Interaction" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Interaction" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Interaction" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Interaction_userId_contextSpaceId_idx" ON "Interaction"("userId", "contextSpaceId");

ALTER TABLE "Reminder" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Reminder" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Reminder" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Reminder" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Reminder_userId_contextSpaceId_idx" ON "Reminder"("userId", "contextSpaceId");

ALTER TABLE "ContactRelationship" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ContactRelationship" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ContactRelationship" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ContactRelationship" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ContactRelationship" ADD CONSTRAINT "ContactRelationship_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ContactRelationship_userId_contextSpaceId_idx" ON "ContactRelationship"("userId", "contextSpaceId");

ALTER TABLE "Deal" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Deal" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Deal" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Deal" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Deal_userId_contextSpaceId_idx" ON "Deal"("userId", "contextSpaceId");

ALTER TABLE "DealNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "DealNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "DealNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "DealNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "DealNote" ADD CONSTRAINT "DealNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DealNote_userId_contextSpaceId_idx" ON "DealNote"("userId", "contextSpaceId");

ALTER TABLE "DealContact" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "DealContact" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "DealContact" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "DealContact" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DealContact_userId_contextSpaceId_idx" ON "DealContact"("userId", "contextSpaceId");

ALTER TABLE "DealContactNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "DealContactNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "DealContactNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "DealContactNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "DealContactNote" ADD CONSTRAINT "DealContactNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DealContactNote_userId_contextSpaceId_idx" ON "DealContactNote"("userId", "contextSpaceId");

ALTER TABLE "Company" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Company" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Company" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Company" ADD CONSTRAINT "Company_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Company_userId_contextSpaceId_idx" ON "Company"("userId", "contextSpaceId");

ALTER TABLE "CompanyNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "CompanyNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "CompanyNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "CompanyNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CompanyNote_userId_contextSpaceId_idx" ON "CompanyNote"("userId", "contextSpaceId");

ALTER TABLE "CompanyContact" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "CompanyContact" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "CompanyContact" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "CompanyContact" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CompanyContact_userId_contextSpaceId_idx" ON "CompanyContact"("userId", "contextSpaceId");

ALTER TABLE "CompanyContactNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "CompanyContactNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "CompanyContactNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "CompanyContactNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "CompanyContactNote" ADD CONSTRAINT "CompanyContactNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CompanyContactNote_userId_contextSpaceId_idx" ON "CompanyContactNote"("userId", "contextSpaceId");

ALTER TABLE "DealCompany" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "DealCompany" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "DealCompany" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "DealCompany" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "DealCompany" ADD CONSTRAINT "DealCompany_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DealCompany_userId_contextSpaceId_idx" ON "DealCompany"("userId", "contextSpaceId");

ALTER TABLE "CompanyRelationship" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "CompanyRelationship" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "CompanyRelationship" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "CompanyRelationship" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "CompanyRelationship" ADD CONSTRAINT "CompanyRelationship_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CompanyRelationship_userId_contextSpaceId_idx" ON "CompanyRelationship"("userId", "contextSpaceId");

ALTER TABLE "Objective" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Objective" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Objective" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Objective" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Objective_userId_contextSpaceId_idx" ON "Objective"("userId", "contextSpaceId");

ALTER TABLE "KnowledgeClaim" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "KnowledgeClaim" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "KnowledgeClaim" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "KnowledgeClaim" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "KnowledgeClaim" ADD CONSTRAINT "KnowledgeClaim_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "KnowledgeClaim_userId_contextSpaceId_idx" ON "KnowledgeClaim"("userId", "contextSpaceId");

ALTER TABLE "KnowledgeEvidence" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "KnowledgeEvidence" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "KnowledgeEvidence" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "KnowledgeEvidence" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "KnowledgeEvidence" ADD CONSTRAINT "KnowledgeEvidence_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "KnowledgeEvidence_userId_contextSpaceId_idx" ON "KnowledgeEvidence"("userId", "contextSpaceId");

ALTER TABLE "Want" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Want" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Want" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Want" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Want" ADD CONSTRAINT "Want_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Want_userId_contextSpaceId_idx" ON "Want"("userId", "contextSpaceId");

ALTER TABLE "WantNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "WantNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "WantNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "WantNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "WantNote" ADD CONSTRAINT "WantNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "WantNote_userId_contextSpaceId_idx" ON "WantNote"("userId", "contextSpaceId");

ALTER TABLE "Offer" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Offer" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Offer" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Offer" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Offer_userId_contextSpaceId_idx" ON "Offer"("userId", "contextSpaceId");

ALTER TABLE "OfferNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "OfferNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "OfferNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "OfferNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "OfferNote" ADD CONSTRAINT "OfferNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OfferNote_userId_contextSpaceId_idx" ON "OfferNote"("userId", "contextSpaceId");

ALTER TABLE "Introduction" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Introduction" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Introduction" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Introduction" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Introduction_userId_contextSpaceId_idx" ON "Introduction"("userId", "contextSpaceId");

ALTER TABLE "IntroductionParticipant" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "IntroductionParticipant" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "IntroductionParticipant" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "IntroductionParticipant" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "IntroductionParticipant" ADD CONSTRAINT "IntroductionParticipant_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "IntroductionParticipant_userId_contextSpaceId_idx" ON "IntroductionParticipant"("userId", "contextSpaceId");

ALTER TABLE "Outcome" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Outcome" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Outcome" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Outcome" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Outcome_userId_contextSpaceId_idx" ON "Outcome"("userId", "contextSpaceId");

ALTER TABLE "MarketLead" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "MarketLead" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "MarketLead" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "MarketLead" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "MarketLead" ADD CONSTRAINT "MarketLead_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "MarketLead_userId_contextSpaceId_idx" ON "MarketLead"("userId", "contextSpaceId");

ALTER TABLE "MarketLeadNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "MarketLeadNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "MarketLeadNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "MarketLeadNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "MarketLeadNote" ADD CONSTRAINT "MarketLeadNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "MarketLeadNote_userId_contextSpaceId_idx" ON "MarketLeadNote"("userId", "contextSpaceId");

ALTER TABLE "Project" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Project" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Project" ADD CONSTRAINT "Project_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Project_userId_contextSpaceId_idx" ON "Project"("userId", "contextSpaceId");

ALTER TABLE "ProjectWorkstream" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ProjectWorkstream" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ProjectWorkstream" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ProjectWorkstream" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ProjectWorkstream" ADD CONSTRAINT "ProjectWorkstream_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ProjectWorkstream_userId_contextSpaceId_idx" ON "ProjectWorkstream"("userId", "contextSpaceId");

ALTER TABLE "ProjectDeal" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ProjectDeal" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ProjectDeal" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ProjectDeal" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ProjectDeal" ADD CONSTRAINT "ProjectDeal_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ProjectDeal_userId_contextSpaceId_idx" ON "ProjectDeal"("userId", "contextSpaceId");

ALTER TABLE "ProjectNote" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ProjectNote" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ProjectNote" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ProjectNote" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ProjectNote_userId_contextSpaceId_idx" ON "ProjectNote"("userId", "contextSpaceId");

ALTER TABLE "Task" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Task" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Task" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Task" ADD CONSTRAINT "Task_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Task_userId_contextSpaceId_idx" ON "Task"("userId", "contextSpaceId");

ALTER TABLE "ResearchCandidate" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ResearchCandidate" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ResearchCandidate" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ResearchCandidate" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ResearchCandidate" ADD CONSTRAINT "ResearchCandidate_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResearchCandidate_userId_contextSpaceId_idx" ON "ResearchCandidate"("userId", "contextSpaceId");

ALTER TABLE "ResearchSource" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ResearchSource" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ResearchSource" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ResearchSource" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ResearchSource_userId_contextSpaceId_idx" ON "ResearchSource"("userId", "contextSpaceId");

ALTER TABLE "ContactEnrichment" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ContactEnrichment" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ContactEnrichment" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ContactEnrichment" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ContactEnrichment" ADD CONSTRAINT "ContactEnrichment_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ContactEnrichment_userId_contextSpaceId_idx" ON "ContactEnrichment"("userId", "contextSpaceId");

ALTER TABLE "OpportunityScore" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "OpportunityScore" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "OpportunityScore" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "OpportunityScore" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OpportunityScore_userId_contextSpaceId_idx" ON "OpportunityScore"("userId", "contextSpaceId");

ALTER TABLE "OpportunityScoreFactor" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "OpportunityScoreFactor" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "OpportunityScoreFactor" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "OpportunityScoreFactor" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "OpportunityScoreFactor" ADD CONSTRAINT "OpportunityScoreFactor_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OpportunityScoreFactor_userId_contextSpaceId_idx" ON "OpportunityScoreFactor"("userId", "contextSpaceId");

ALTER TABLE "AgentRun" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "AgentRun" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "AgentRun" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "AgentRun" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AgentRun_userId_contextSpaceId_idx" ON "AgentRun"("userId", "contextSpaceId");

ALTER TABLE "AgentToolCall" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "AgentToolCall" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "AgentToolCall" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "AgentToolCall" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AgentToolCall_userId_contextSpaceId_idx" ON "AgentToolCall"("userId", "contextSpaceId");

ALTER TABLE "ModelInvocation" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ModelInvocation" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ModelInvocation" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ModelInvocation" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ModelInvocation" ADD CONSTRAINT "ModelInvocation_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ModelInvocation_userId_contextSpaceId_idx" ON "ModelInvocation"("userId", "contextSpaceId");

ALTER TABLE "AgentArtifact" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "AgentArtifact" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "AgentArtifact" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "AgentArtifact" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AgentArtifact_userId_contextSpaceId_idx" ON "AgentArtifact"("userId", "contextSpaceId");

ALTER TABLE "ApprovalRequest" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "ApprovalRequest" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "ApprovalRequest" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "ApprovalRequest" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ApprovalRequest_userId_contextSpaceId_idx" ON "ApprovalRequest"("userId", "contextSpaceId");

-- Verify all existing context-scoped foreign-key relationships stay inside the same custody context.
-- IT: Context-local taxonomy/source metadata also belongs to the custody space.
ALTER TABLE "Tag" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "Tag" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "Tag" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS "Tag_userId_name_key";
DROP INDEX IF EXISTS "Tag_userId_slug_key";
CREATE UNIQUE INDEX "Tag_userId_contextSpaceId_name_key" ON "Tag"("userId", "contextSpaceId", "name");
CREATE UNIQUE INDEX "Tag_userId_contextSpaceId_slug_key" ON "Tag"("userId", "contextSpaceId", "slug");
CREATE INDEX "Tag_userId_contextSpaceId_idx" ON "Tag"("userId", "contextSpaceId");

ALTER TABLE "CompanyTag" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "CompanyTag" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "CompanyTag" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "CompanyTag" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "CompanyTag" ADD CONSTRAINT "CompanyTag_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CompanyTag_userId_contextSpaceId_idx" ON "CompanyTag"("userId", "contextSpaceId");

ALTER TABLE "LeadSource" ADD COLUMN "contextSpaceId" TEXT;
UPDATE "LeadSource" SET "contextSpaceId" = "userId" WHERE "contextSpaceId" IS NULL;
ALTER TABLE "LeadSource" ALTER COLUMN "contextSpaceId" SET NOT NULL;
ALTER TABLE "LeadSource" ALTER COLUMN "contextSpaceId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_contextSpaceId_fkey" FOREIGN KEY ("contextSpaceId") REFERENCES "ContextSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS "LeadSource_userId_nameIdx_key";
CREATE UNIQUE INDEX "LeadSource_userId_contextSpaceId_nameIdx_key" ON "LeadSource"("userId", "contextSpaceId", "nameIdx");
CREATE INDEX "LeadSource_userId_contextSpaceId_idx" ON "LeadSource"("userId", "contextSpaceId");

-- IT: Context-local uniqueness must not block the same identity/external reference in a second space.
DROP INDEX IF EXISTS "Contact_userId_linkedUserId_key";
CREATE UNIQUE INDEX "Contact_userId_contextSpaceId_linkedUserId_key" ON "Contact"("userId", "contextSpaceId", "linkedUserId");
DROP INDEX IF EXISTS "Interaction_userId_sourceType_externalRef_key";
CREATE UNIQUE INDEX "Interaction_userId_contextSpaceId_sourceType_externalRef_key" ON "Interaction"("userId", "contextSpaceId", "sourceType", "externalRef");

DO $$
DECLARE bad_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM "Interaction" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Interaction.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Interaction" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Interaction.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Reminder" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Reminder.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ContactRelationship" c JOIN "Contact" p ON p."id" = c."contactAId" WHERE c."contactAId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ContactRelationship.contactAId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ContactRelationship" c JOIN "Contact" p ON p."id" = c."contactBId" WHERE c."contactBId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ContactRelationship.contactBId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealNote" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealNote.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealNote" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealNote.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealContact" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealContact.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealContact" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealContact.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealContact" c JOIN "CompanyContact" p ON p."id" = c."companyContactId" WHERE c."companyContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealContact.companyContactId has % cross-context reference(s) to CompanyContact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealContactNote" c JOIN "DealContact" p ON p."id" = c."dealContactId" WHERE c."dealContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealContactNote.dealContactId has % cross-context reference(s) to DealContact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealContactNote" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealContactNote.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealContactNote" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealContactNote.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyNote" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyNote.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyContact" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyContact.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyContact" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyContact.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyContactNote" c JOIN "CompanyContact" p ON p."id" = c."companyContactId" WHERE c."companyContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyContactNote.companyContactId has % cross-context reference(s) to CompanyContact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyContactNote" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyContactNote.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyContactNote" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyContactNote.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealCompany" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealCompany.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "DealCompany" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: DealCompany.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyRelationship" c JOIN "Company" p ON p."id" = c."companyAId" WHERE c."companyAId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyRelationship.companyAId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyRelationship" c JOIN "Company" p ON p."id" = c."companyBId" WHERE c."companyBId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyRelationship.companyBId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Objective" c JOIN "Interaction" p ON p."id" = c."sourceInteractionId" WHERE c."sourceInteractionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Objective.sourceInteractionId has % cross-context reference(s) to Interaction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Objective" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Objective.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Objective" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Objective.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeClaim" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeClaim.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeClaim" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeClaim.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeClaim" c JOIN "Objective" p ON p."id" = c."objectiveId" WHERE c."objectiveId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeClaim.objectiveId has % cross-context reference(s) to Objective', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeClaim" c JOIN "Want" p ON p."id" = c."wantId" WHERE c."wantId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeClaim.wantId has % cross-context reference(s) to Want', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeClaim" c JOIN "Offer" p ON p."id" = c."offerId" WHERE c."offerId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeClaim.offerId has % cross-context reference(s) to Offer', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeEvidence" c JOIN "KnowledgeClaim" p ON p."id" = c."claimId" WHERE c."claimId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeEvidence.claimId has % cross-context reference(s) to KnowledgeClaim', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeEvidence" c JOIN "Interaction" p ON p."id" = c."sourceInteractionId" WHERE c."sourceInteractionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeEvidence.sourceInteractionId has % cross-context reference(s) to Interaction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Want" c JOIN "Interaction" p ON p."id" = c."sourceInteractionId" WHERE c."sourceInteractionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want.sourceInteractionId has % cross-context reference(s) to Interaction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Want" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Want" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Want" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Want" c JOIN "Project" p ON p."id" = c."projectId" WHERE c."projectId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want.projectId has % cross-context reference(s) to Project', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Want" c JOIN "ProjectWorkstream" p ON p."id" = c."workstreamId" WHERE c."workstreamId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want.workstreamId has % cross-context reference(s) to ProjectWorkstream', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Want" c JOIN "CompanyContact" p ON p."id" = c."companyContactId" WHERE c."companyContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want.companyContactId has % cross-context reference(s) to CompanyContact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "WantNote" c JOIN "Want" p ON p."id" = c."wantId" WHERE c."wantId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: WantNote.wantId has % cross-context reference(s) to Want', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Offer" c JOIN "Interaction" p ON p."id" = c."sourceInteractionId" WHERE c."sourceInteractionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer.sourceInteractionId has % cross-context reference(s) to Interaction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Offer" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Offer" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Offer" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Offer" c JOIN "Project" p ON p."id" = c."projectId" WHERE c."projectId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer.projectId has % cross-context reference(s) to Project', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Offer" c JOIN "ProjectWorkstream" p ON p."id" = c."workstreamId" WHERE c."workstreamId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer.workstreamId has % cross-context reference(s) to ProjectWorkstream', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Offer" c JOIN "CompanyContact" p ON p."id" = c."companyContactId" WHERE c."companyContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer.companyContactId has % cross-context reference(s) to CompanyContact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OfferNote" c JOIN "Offer" p ON p."id" = c."offerId" WHERE c."offerId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OfferNote.offerId has % cross-context reference(s) to Offer', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Introduction" c JOIN "Interaction" p ON p."id" = c."sourceInteractionId" WHERE c."sourceInteractionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Introduction.sourceInteractionId has % cross-context reference(s) to Interaction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Introduction" c JOIN "Contact" p ON p."id" = c."facilitatorContactId" WHERE c."facilitatorContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Introduction.facilitatorContactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "IntroductionParticipant" c JOIN "Introduction" p ON p."id" = c."introductionId" WHERE c."introductionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: IntroductionParticipant.introductionId has % cross-context reference(s) to Introduction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "IntroductionParticipant" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: IntroductionParticipant.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "IntroductionParticipant" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: IntroductionParticipant.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Outcome" c JOIN "Introduction" p ON p."id" = c."introductionId" WHERE c."introductionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Outcome.introductionId has % cross-context reference(s) to Introduction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Outcome" c JOIN "Interaction" p ON p."id" = c."sourceInteractionId" WHERE c."sourceInteractionId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Outcome.sourceInteractionId has % cross-context reference(s) to Interaction', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "Project" p ON p."id" = c."projectId" WHERE c."projectId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.projectId has % cross-context reference(s) to Project', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "ProjectWorkstream" p ON p."id" = c."workstreamId" WHERE c."workstreamId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.workstreamId has % cross-context reference(s) to ProjectWorkstream', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "Want" p ON p."id" = c."wantId" WHERE c."wantId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.wantId has % cross-context reference(s) to Want', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "Offer" p ON p."id" = c."offerId" WHERE c."offerId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.offerId has % cross-context reference(s) to Offer', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLeadNote" c JOIN "MarketLead" p ON p."id" = c."marketLeadId" WHERE c."marketLeadId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLeadNote.marketLeadId has % cross-context reference(s) to MarketLead', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ProjectWorkstream" c JOIN "Project" p ON p."id" = c."projectId" WHERE c."projectId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ProjectWorkstream.projectId has % cross-context reference(s) to Project', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ProjectDeal" c JOIN "Project" p ON p."id" = c."projectId" WHERE c."projectId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ProjectDeal.projectId has % cross-context reference(s) to Project', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ProjectDeal" c JOIN "ProjectWorkstream" p ON p."id" = c."workstreamId" WHERE c."workstreamId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ProjectDeal.workstreamId has % cross-context reference(s) to ProjectWorkstream', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ProjectDeal" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ProjectDeal.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ProjectNote" c JOIN "Project" p ON p."id" = c."projectId" WHERE c."projectId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ProjectNote.projectId has % cross-context reference(s) to Project', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ProjectNote" c JOIN "ProjectWorkstream" p ON p."id" = c."workstreamId" WHERE c."workstreamId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ProjectNote.workstreamId has % cross-context reference(s) to ProjectWorkstream', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Contact" p ON p."id" = c."assignedToContactId" WHERE c."assignedToContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.assignedToContactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Contact" p ON p."id" = c."waitingOnContactId" WHERE c."waitingOnContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.waitingOnContactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "DealContact" p ON p."id" = c."dealContactId" WHERE c."dealContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.dealContactId has % cross-context reference(s) to DealContact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Project" p ON p."id" = c."projectId" WHERE c."projectId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.projectId has % cross-context reference(s) to Project', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "ProjectWorkstream" p ON p."id" = c."workstreamId" WHERE c."workstreamId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.workstreamId has % cross-context reference(s) to ProjectWorkstream', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "MarketLead" p ON p."id" = c."marketLeadId" WHERE c."marketLeadId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.marketLeadId has % cross-context reference(s) to MarketLead', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Want" p ON p."id" = c."wantId" WHERE c."wantId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.wantId has % cross-context reference(s) to Want', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Offer" p ON p."id" = c."offerId" WHERE c."offerId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.offerId has % cross-context reference(s) to Offer', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "CompanyContact" p ON p."id" = c."companyContactId" WHERE c."companyContactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.companyContactId has % cross-context reference(s) to CompanyContact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Task" c JOIN "DealCompany" p ON p."id" = c."dealCompanyId" WHERE c."dealCompanyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Task.dealCompanyId has % cross-context reference(s) to DealCompany', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ResearchCandidate" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ResearchCandidate.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ResearchSource" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ResearchSource.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ResearchSource" c JOIN "ResearchCandidate" p ON p."id" = c."researchCandidateId" WHERE c."researchCandidateId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ResearchSource.researchCandidateId has % cross-context reference(s) to ResearchCandidate', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ResearchSource" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ResearchSource.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ResearchSource" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ResearchSource.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ContactEnrichment" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ContactEnrichment.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ContactEnrichment" c JOIN "ResearchCandidate" p ON p."id" = c."researchCandidateId" WHERE c."researchCandidateId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ContactEnrichment.researchCandidateId has % cross-context reference(s) to ResearchCandidate', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ContactEnrichment" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ContactEnrichment.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ContactEnrichment" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ContactEnrichment.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScore" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScore.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScore" c JOIN "ResearchCandidate" p ON p."id" = c."researchCandidateId" WHERE c."researchCandidateId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScore.researchCandidateId has % cross-context reference(s) to ResearchCandidate', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScore" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScore.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScore" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScore.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScore" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScore.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScoreFactor" c JOIN "OpportunityScore" p ON p."id" = c."opportunityScoreId" WHERE c."opportunityScoreId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScoreFactor.opportunityScoreId has % cross-context reference(s) to OpportunityScore', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScoreFactor" c JOIN "ResearchCandidate" p ON p."id" = c."researchCandidateId" WHERE c."researchCandidateId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScoreFactor.researchCandidateId has % cross-context reference(s) to ResearchCandidate', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScoreFactor" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."companyId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScoreFactor.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScoreFactor" c JOIN "Contact" p ON p."id" = c."contactId" WHERE c."contactId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScoreFactor.contactId has % cross-context reference(s) to Contact', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "OpportunityScoreFactor" c JOIN "Deal" p ON p."id" = c."dealId" WHERE c."dealId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: OpportunityScoreFactor.dealId has % cross-context reference(s) to Deal', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "AgentToolCall" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: AgentToolCall.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ModelInvocation" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ModelInvocation.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "AgentArtifact" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: AgentArtifact.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ApprovalRequest" c JOIN "AgentRun" p ON p."id" = c."agentRunId" WHERE c."agentRunId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ApprovalRequest.agentRunId has % cross-context reference(s) to AgentRun', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Tag" c JOIN "Tag" p ON p."id" = c."mergedIntoId" WHERE c."mergedIntoId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Tag.mergedIntoId has % cross-context reference(s) to Tag', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "Contact" c JOIN "LeadSource" p ON p."id" = c."leadSourceId" WHERE c."leadSourceId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Contact.leadSourceId has % cross-context reference(s) to LeadSource', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyTag" c JOIN "Company" p ON p."id" = c."companyId" WHERE c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyTag.companyId has % cross-context reference(s) to Company', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "CompanyTag" c JOIN "Tag" p ON p."id" = c."tagId" WHERE c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: CompanyTag.tagId has % cross-context reference(s) to Tag', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "MarketLead" c JOIN "LeadSource" p ON p."id" = c."leadSourceId" WHERE c."leadSourceId" IS NOT NULL AND c."contextSpaceId" <> p."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: MarketLead.leadSourceId has % cross-context reference(s) to LeadSource', bad_count; END IF;
  SELECT COUNT(*) INTO bad_count FROM "ContactTag" ct JOIN "Contact" c ON c."id" = ct."contactId" JOIN "Tag" t ON t."id" = ct."tagId" WHERE c."contextSpaceId" <> t."contextSpaceId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: ContactTag has % cross-context Contact/Tag link(s)', bad_count; END IF;
END $$;

CREATE OR REPLACE FUNCTION "relish_enforce_context_owner"() RETURNS trigger AS $$
DECLARE context_owner TEXT;
BEGIN
  -- IT: Context custody must be supplied deliberately. The sentinel remains only as a
  -- compatibility tripwire for legacy Prisma create inputs that omit contextSpaceId.
  IF NEW."contextSpaceId" IS NULL THEN
    RAISE EXCEPTION 'Context-scoped write to % requires explicit contextSpaceId', TG_TABLE_NAME;
  END IF;
  IF NEW."contextSpaceId" = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Context-scoped write to % cannot use the default ContextSpace sentinel', TG_TABLE_NAME;
  END IF;
  SELECT "ownerUserId" INTO context_owner FROM "ContextSpace" WHERE "id" = NEW."contextSpaceId";
  IF context_owner IS NULL THEN
    RAISE EXCEPTION 'ContextSpace % does not exist', NEW."contextSpaceId";
  END IF;
  IF context_owner <> NEW."userId" THEN
    RAISE EXCEPTION 'ContextSpace % is not owned by user %', NEW."contextSpaceId", NEW."userId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Contact_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Contact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Interaction_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Interaction"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Reminder_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Reminder"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ContactRelationship_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ContactRelationship"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Deal_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Deal"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "DealNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "DealNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "DealContact_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "DealContact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "DealContactNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "DealContactNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Company_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Company"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "CompanyNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "CompanyNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "CompanyContact_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "CompanyContact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "CompanyContactNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "CompanyContactNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "DealCompany_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "DealCompany"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "CompanyRelationship_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "CompanyRelationship"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Objective_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Objective"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "KnowledgeClaim_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "KnowledgeClaim"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "KnowledgeEvidence_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "KnowledgeEvidence"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Want_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Want"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "WantNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "WantNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Offer_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Offer"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "OfferNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "OfferNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Introduction_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Introduction"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "IntroductionParticipant_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "IntroductionParticipant"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Outcome_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Outcome"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "MarketLead_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "MarketLead"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "MarketLeadNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "MarketLeadNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Project_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Project"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ProjectWorkstream_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ProjectWorkstream"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ProjectDeal_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ProjectDeal"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ProjectNote_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ProjectNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Task_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ResearchCandidate_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ResearchCandidate"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ResearchSource_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ResearchSource"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ContactEnrichment_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ContactEnrichment"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "OpportunityScore_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "OpportunityScore"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "OpportunityScoreFactor_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "OpportunityScoreFactor"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "AgentRun_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "AgentRun"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "AgentToolCall_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "AgentToolCall"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ModelInvocation_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ModelInvocation"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "AgentArtifact_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "AgentArtifact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "ApprovalRequest_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "ApprovalRequest"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "Tag_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "Tag"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "CompanyTag_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "CompanyTag"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();
CREATE TRIGGER "LeadSource_context_owner_guard"
BEFORE INSERT OR UPDATE OF "userId", "contextSpaceId" ON "LeadSource"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_owner"();

-- IT: Existing records cannot silently move between custody spaces. Sharing later is explicit copy/grant, not reassignment.
CREATE OR REPLACE FUNCTION "relish_prevent_context_reassignment"() RETURNS trigger AS $$
BEGIN
  IF NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."contextSpaceId" IS DISTINCT FROM OLD."contextSpaceId" THEN
    RAISE EXCEPTION 'Custody reassignment blocked for %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Contact_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Contact"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Interaction_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Interaction"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Reminder_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Reminder"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ContactRelationship_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ContactRelationship"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Deal_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Deal"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "DealNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "DealNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "DealContact_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "DealContact"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "DealContactNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "DealContactNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Company_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Company"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "CompanyNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "CompanyNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "CompanyContact_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "CompanyContact"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "CompanyContactNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "CompanyContactNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "DealCompany_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "DealCompany"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "CompanyRelationship_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "CompanyRelationship"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Objective_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Objective"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "KnowledgeClaim_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "KnowledgeClaim"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "KnowledgeEvidence_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "KnowledgeEvidence"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Want_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Want"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "WantNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "WantNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Offer_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Offer"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "OfferNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "OfferNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Introduction_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Introduction"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "IntroductionParticipant_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "IntroductionParticipant"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Outcome_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Outcome"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "MarketLead_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "MarketLead"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "MarketLeadNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "MarketLeadNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Project_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Project"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ProjectWorkstream_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ProjectWorkstream"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ProjectDeal_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ProjectDeal"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ProjectNote_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ProjectNote"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Task_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ResearchCandidate_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ResearchCandidate"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ResearchSource_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ResearchSource"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ContactEnrichment_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ContactEnrichment"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "OpportunityScore_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "OpportunityScore"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "OpportunityScoreFactor_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "OpportunityScoreFactor"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "AgentRun_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "AgentRun"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "AgentToolCall_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "AgentToolCall"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ModelInvocation_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ModelInvocation"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "AgentArtifact_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "AgentArtifact"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "ApprovalRequest_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "ApprovalRequest"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "Tag_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "Tag"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "CompanyTag_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "CompanyTag"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();
CREATE TRIGGER "LeadSource_context_reassignment_guard"
BEFORE UPDATE OF "userId", "contextSpaceId" ON "LeadSource"
FOR EACH ROW EXECUTE FUNCTION "relish_prevent_context_reassignment"();

CREATE OR REPLACE FUNCTION "relish_enforce_context_reference"() RETURNS trigger AS $$
DECLARE i INTEGER; fk_col TEXT; ref_table TEXT; fk_value TEXT; ref_context TEXT;
BEGIN
  i := 0;
  WHILE i < TG_NARGS LOOP
    fk_col := TG_ARGV[i];
    ref_table := TG_ARGV[i + 1];
    fk_value := to_jsonb(NEW) ->> fk_col;
    IF fk_value IS NOT NULL AND fk_value <> '' THEN
      EXECUTE format('SELECT "contextSpaceId" FROM %I WHERE "id" = $1', ref_table) INTO ref_context USING fk_value;
      IF ref_context IS NOT NULL AND ref_context <> NEW."contextSpaceId" THEN
        RAISE EXCEPTION 'Cross-context reference blocked: %.% -> %', TG_TABLE_NAME, fk_col, ref_table;
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Tag_context_reference_guard"
BEFORE INSERT OR UPDATE OF "mergedIntoId" ON "Tag"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('mergedIntoId', 'Tag');
CREATE TRIGGER "Contact_context_reference_guard"
BEFORE INSERT OR UPDATE OF "leadSourceId" ON "Contact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('leadSourceId', 'LeadSource');
CREATE TRIGGER "CompanyTag_context_reference_guard"
BEFORE INSERT OR UPDATE OF "companyId", "tagId" ON "CompanyTag"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('companyId', 'Company', 'tagId', 'Tag');
CREATE TRIGGER "Interaction_context_reference_guard"
BEFORE INSERT OR UPDATE OF "contactId", "companyId" ON "Interaction"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'companyId', 'Company');
CREATE TRIGGER "Reminder_context_reference_guard"
BEFORE INSERT OR UPDATE OF "contactId" ON "Reminder"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact');
CREATE TRIGGER "ContactRelationship_context_reference_guard"
BEFORE INSERT OR UPDATE OF "contactAId", "contactBId" ON "ContactRelationship"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactAId', 'Contact', 'contactBId', 'Contact');
CREATE TRIGGER "DealNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "dealId", "contactId" ON "DealNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('dealId', 'Deal', 'contactId', 'Contact');
CREATE TRIGGER "DealContact_context_reference_guard"
BEFORE INSERT OR UPDATE OF "dealId", "contactId", "companyContactId" ON "DealContact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('dealId', 'Deal', 'contactId', 'Contact', 'companyContactId', 'CompanyContact');
CREATE TRIGGER "DealContactNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "dealContactId", "dealId", "contactId" ON "DealContactNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('dealContactId', 'DealContact', 'dealId', 'Deal', 'contactId', 'Contact');
CREATE TRIGGER "CompanyNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "companyId" ON "CompanyNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('companyId', 'Company');
CREATE TRIGGER "CompanyContact_context_reference_guard"
BEFORE INSERT OR UPDATE OF "companyId", "contactId" ON "CompanyContact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('companyId', 'Company', 'contactId', 'Contact');
CREATE TRIGGER "CompanyContactNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "companyContactId", "companyId", "contactId" ON "CompanyContactNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('companyContactId', 'CompanyContact', 'companyId', 'Company', 'contactId', 'Contact');
CREATE TRIGGER "DealCompany_context_reference_guard"
BEFORE INSERT OR UPDATE OF "dealId", "companyId" ON "DealCompany"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('dealId', 'Deal', 'companyId', 'Company');
CREATE TRIGGER "CompanyRelationship_context_reference_guard"
BEFORE INSERT OR UPDATE OF "companyAId", "companyBId" ON "CompanyRelationship"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('companyAId', 'Company', 'companyBId', 'Company');
CREATE TRIGGER "Objective_context_reference_guard"
BEFORE INSERT OR UPDATE OF "sourceInteractionId", "contactId", "companyId" ON "Objective"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('sourceInteractionId', 'Interaction', 'contactId', 'Contact', 'companyId', 'Company');
CREATE TRIGGER "KnowledgeClaim_context_reference_guard"
BEFORE INSERT OR UPDATE OF "contactId", "companyId", "objectiveId", "wantId", "offerId" ON "KnowledgeClaim"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'companyId', 'Company', 'objectiveId', 'Objective', 'wantId', 'Want', 'offerId', 'Offer');
CREATE TRIGGER "KnowledgeEvidence_context_reference_guard"
BEFORE INSERT OR UPDATE OF "claimId", "sourceInteractionId" ON "KnowledgeEvidence"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('claimId', 'KnowledgeClaim', 'sourceInteractionId', 'Interaction');
CREATE TRIGGER "Want_context_reference_guard"
BEFORE INSERT OR UPDATE OF "sourceInteractionId", "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId" ON "Want"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('sourceInteractionId', 'Interaction', 'contactId', 'Contact', 'companyId', 'Company', 'dealId', 'Deal', 'projectId', 'Project', 'workstreamId', 'ProjectWorkstream', 'companyContactId', 'CompanyContact');
CREATE TRIGGER "WantNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "wantId" ON "WantNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('wantId', 'Want');
CREATE TRIGGER "Offer_context_reference_guard"
BEFORE INSERT OR UPDATE OF "sourceInteractionId", "contactId", "companyId", "dealId", "projectId", "workstreamId", "companyContactId" ON "Offer"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('sourceInteractionId', 'Interaction', 'contactId', 'Contact', 'companyId', 'Company', 'dealId', 'Deal', 'projectId', 'Project', 'workstreamId', 'ProjectWorkstream', 'companyContactId', 'CompanyContact');
CREATE TRIGGER "OfferNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "offerId" ON "OfferNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('offerId', 'Offer');
CREATE TRIGGER "Introduction_context_reference_guard"
BEFORE INSERT OR UPDATE OF "sourceInteractionId", "facilitatorContactId" ON "Introduction"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('sourceInteractionId', 'Interaction', 'facilitatorContactId', 'Contact');
CREATE TRIGGER "IntroductionParticipant_context_reference_guard"
BEFORE INSERT OR UPDATE OF "introductionId", "contactId", "companyId" ON "IntroductionParticipant"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('introductionId', 'Introduction', 'contactId', 'Contact', 'companyId', 'Company');
CREATE TRIGGER "Outcome_context_reference_guard"
BEFORE INSERT OR UPDATE OF "introductionId", "sourceInteractionId" ON "Outcome"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('introductionId', 'Introduction', 'sourceInteractionId', 'Interaction');
CREATE TRIGGER "MarketLead_context_reference_guard"
BEFORE INSERT OR UPDATE OF "contactId", "companyId", "dealId", "projectId", "workstreamId", "wantId", "offerId", "leadSourceId" ON "MarketLead"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('contactId', 'Contact', 'companyId', 'Company', 'dealId', 'Deal', 'projectId', 'Project', 'workstreamId', 'ProjectWorkstream', 'wantId', 'Want', 'offerId', 'Offer', 'leadSourceId', 'LeadSource');
CREATE TRIGGER "MarketLeadNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "marketLeadId" ON "MarketLeadNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('marketLeadId', 'MarketLead');
CREATE TRIGGER "ProjectWorkstream_context_reference_guard"
BEFORE INSERT OR UPDATE OF "projectId" ON "ProjectWorkstream"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('projectId', 'Project');
CREATE TRIGGER "ProjectDeal_context_reference_guard"
BEFORE INSERT OR UPDATE OF "projectId", "workstreamId", "dealId" ON "ProjectDeal"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('projectId', 'Project', 'workstreamId', 'ProjectWorkstream', 'dealId', 'Deal');
CREATE TRIGGER "ProjectNote_context_reference_guard"
BEFORE INSERT OR UPDATE OF "projectId", "workstreamId" ON "ProjectNote"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('projectId', 'Project', 'workstreamId', 'ProjectWorkstream');
CREATE TRIGGER "Task_context_reference_guard"
BEFORE INSERT OR UPDATE OF "assignedToContactId", "waitingOnContactId", "contactId", "dealId", "dealContactId", "projectId", "workstreamId", "marketLeadId", "wantId", "offerId", "companyId", "companyContactId", "dealCompanyId" ON "Task"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('assignedToContactId', 'Contact', 'waitingOnContactId', 'Contact', 'contactId', 'Contact', 'dealId', 'Deal', 'dealContactId', 'DealContact', 'projectId', 'Project', 'workstreamId', 'ProjectWorkstream', 'marketLeadId', 'MarketLead', 'wantId', 'Want', 'offerId', 'Offer', 'companyId', 'Company', 'companyContactId', 'CompanyContact', 'dealCompanyId', 'DealCompany');
CREATE TRIGGER "ResearchCandidate_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId" ON "ResearchCandidate"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun');
CREATE TRIGGER "ResearchSource_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId", "researchCandidateId", "companyId", "contactId" ON "ResearchSource"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun', 'researchCandidateId', 'ResearchCandidate', 'companyId', 'Company', 'contactId', 'Contact');
CREATE TRIGGER "ContactEnrichment_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId", "researchCandidateId", "companyId", "contactId" ON "ContactEnrichment"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun', 'researchCandidateId', 'ResearchCandidate', 'companyId', 'Company', 'contactId', 'Contact');
CREATE TRIGGER "OpportunityScore_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId", "researchCandidateId", "companyId", "contactId", "dealId" ON "OpportunityScore"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun', 'researchCandidateId', 'ResearchCandidate', 'companyId', 'Company', 'contactId', 'Contact', 'dealId', 'Deal');
CREATE TRIGGER "OpportunityScoreFactor_context_reference_guard"
BEFORE INSERT OR UPDATE OF "opportunityScoreId", "researchCandidateId", "companyId", "contactId", "dealId" ON "OpportunityScoreFactor"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('opportunityScoreId', 'OpportunityScore', 'researchCandidateId', 'ResearchCandidate', 'companyId', 'Company', 'contactId', 'Contact', 'dealId', 'Deal');
CREATE TRIGGER "AgentToolCall_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId" ON "AgentToolCall"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun');
CREATE TRIGGER "ModelInvocation_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId" ON "ModelInvocation"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun');
CREATE TRIGGER "AgentArtifact_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId" ON "AgentArtifact"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun');
CREATE TRIGGER "ApprovalRequest_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId" ON "ApprovalRequest"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_context_reference"('agentRunId', 'AgentRun');

-- SECURITY: AgentRunEntity inherits custody from AgentRun, but its polymorphic target must still belong to that same context.
CREATE OR REPLACE FUNCTION "relish_resolve_agent_entity_context"(
  run_user TEXT,
  run_context TEXT,
  entity_type TEXT,
  entity_id TEXT
) RETURNS TEXT AS $$
DECLARE entity_context TEXT;
BEGIN
  CASE lower(entity_type)
    WHEN 'contact' THEN SELECT "contextSpaceId" INTO entity_context FROM "Contact" WHERE "id" = entity_id;
    WHEN 'company' THEN SELECT "contextSpaceId" INTO entity_context FROM "Company" WHERE "id" = entity_id;
    WHEN 'deal' THEN SELECT "contextSpaceId" INTO entity_context FROM "Deal" WHERE "id" = entity_id;
    WHEN 'project' THEN SELECT "contextSpaceId" INTO entity_context FROM "Project" WHERE "id" = entity_id;
    WHEN 'task' THEN SELECT "contextSpaceId" INTO entity_context FROM "Task" WHERE "id" = entity_id;
    WHEN 'research_candidate' THEN SELECT "contextSpaceId" INTO entity_context FROM "ResearchCandidate" WHERE "id" = entity_id;
    WHEN 'research_source' THEN SELECT "contextSpaceId" INTO entity_context FROM "ResearchSource" WHERE "id" = entity_id;
    WHEN 'contact_enrichment' THEN SELECT "contextSpaceId" INTO entity_context FROM "ContactEnrichment" WHERE "id" = entity_id;
    WHEN 'opportunity_score' THEN SELECT "contextSpaceId" INTO entity_context FROM "OpportunityScore" WHERE "id" = entity_id;
    WHEN 'want' THEN SELECT "contextSpaceId" INTO entity_context FROM "Want" WHERE "id" = entity_id;
    WHEN 'offer' THEN SELECT "contextSpaceId" INTO entity_context FROM "Offer" WHERE "id" = entity_id;
    WHEN 'objective' THEN SELECT "contextSpaceId" INTO entity_context FROM "Objective" WHERE "id" = entity_id;
    WHEN 'knowledge_claim' THEN SELECT "contextSpaceId" INTO entity_context FROM "KnowledgeClaim" WHERE "id" = entity_id;
    WHEN 'interaction' THEN SELECT "contextSpaceId" INTO entity_context FROM "Interaction" WHERE "id" = entity_id;
    WHEN 'introduction' THEN SELECT "contextSpaceId" INTO entity_context FROM "Introduction" WHERE "id" = entity_id;
    WHEN 'outcome' THEN SELECT "contextSpaceId" INTO entity_context FROM "Outcome" WHERE "id" = entity_id;
    WHEN 'market_lead' THEN SELECT "contextSpaceId" INTO entity_context FROM "MarketLead" WHERE "id" = entity_id;
    WHEN 'project_workstream' THEN SELECT "contextSpaceId" INTO entity_context FROM "ProjectWorkstream" WHERE "id" = entity_id;
    WHEN 'company_contact' THEN SELECT "contextSpaceId" INTO entity_context FROM "CompanyContact" WHERE "id" = entity_id;
    WHEN 'deal_contact' THEN SELECT "contextSpaceId" INTO entity_context FROM "DealContact" WHERE "id" = entity_id;
    WHEN 'deal_company' THEN SELECT "contextSpaceId" INTO entity_context FROM "DealCompany" WHERE "id" = entity_id;
    WHEN 'person' THEN
      IF EXISTS (SELECT 1 FROM "User" WHERE "id" = run_user AND "personId" = entity_id) OR
         EXISTS (SELECT 1 FROM "Contact" WHERE "userId" = run_user AND "contextSpaceId" = run_context AND "personId" = entity_id) THEN
        entity_context := run_context;
      END IF;
    ELSE
      entity_context := NULL;
  END CASE;
  RETURN entity_context;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "relish_agent_entity_type_supported"(entity_type TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN lower(entity_type) = ANY (ARRAY[
    'contact','company','deal','project','task','research_candidate','research_source','contact_enrichment','opportunity_score',
    'want','offer','objective','knowledge_claim','interaction','introduction','outcome','market_lead','project_workstream',
    'company_contact','deal_contact','deal_company','person'
  ]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION "relish_enforce_agent_run_entity_context"() RETURNS trigger AS $$
DECLARE run_user TEXT; run_context TEXT; entity_context TEXT;
BEGIN
  SELECT "userId", "contextSpaceId" INTO run_user, run_context FROM "AgentRun" WHERE "id" = NEW."agentRunId";
  IF run_context IS NULL THEN
    RAISE EXCEPTION 'AgentRun % does not exist', NEW."agentRunId";
  END IF;
  IF NOT "relish_agent_entity_type_supported"(NEW."entityType") THEN
    RAISE EXCEPTION 'Unsupported AgentRunEntity entity type: %', NEW."entityType";
  END IF;
  entity_context := "relish_resolve_agent_entity_context"(run_user, run_context, NEW."entityType", NEW."entityId");
  IF entity_context IS NULL THEN
    RAISE EXCEPTION 'AgentRunEntity target %.% is not accessible to run %', NEW."entityType", NEW."entityId", NEW."agentRunId";
  END IF;
  IF entity_context <> run_context THEN
    RAISE EXCEPTION 'Cross-context AgentRunEntity link blocked: run % is in %, target %.% is in %', NEW."agentRunId", run_context, NEW."entityType", NEW."entityId", entity_context;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify historical polymorphic links before installing the write guard.
DO $$
DECLARE row_data RECORD; run_user TEXT; run_context TEXT; entity_context TEXT;
BEGIN
  FOR row_data IN SELECT "id", "agentRunId", "entityType", "entityId" FROM "AgentRunEntity" LOOP
    SELECT "userId", "contextSpaceId" INTO run_user, run_context FROM "AgentRun" WHERE "id" = row_data."agentRunId";
    IF run_context IS NULL THEN
      RAISE EXCEPTION 'Stage 8.6 aborted: AgentRunEntity % points to missing AgentRun %', row_data."id", row_data."agentRunId";
    END IF;
    -- Historical log links can legitimately be stale after a target record was deleted.
    -- Unknown/missing historical links remain inert audit text; only a resolvable target in another context is migration-blocking.
    IF "relish_agent_entity_type_supported"(row_data."entityType") THEN
      entity_context := "relish_resolve_agent_entity_context"(run_user, run_context, row_data."entityType", row_data."entityId");
      IF entity_context IS NOT NULL AND entity_context <> run_context THEN
        RAISE EXCEPTION 'Stage 8.6 aborted: AgentRunEntity % target %.% belongs to a different ContextSpace than run %', row_data."id", row_data."entityType", row_data."entityId", row_data."agentRunId";
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE TRIGGER "AgentRunEntity_context_reference_guard"
BEFORE INSERT OR UPDATE OF "agentRunId", "entityType", "entityId" ON "AgentRunEntity"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_agent_run_entity_context"();

CREATE OR REPLACE FUNCTION "relish_enforce_contact_tag_context"() RETURNS trigger AS $$
DECLARE contact_context TEXT; tag_context TEXT;
BEGIN
  SELECT "contextSpaceId" INTO contact_context FROM "Contact" WHERE "id" = NEW."contactId";
  SELECT "contextSpaceId" INTO tag_context FROM "Tag" WHERE "id" = NEW."tagId";
  IF contact_context IS NULL OR tag_context IS NULL OR contact_context <> tag_context THEN
    RAISE EXCEPTION 'Cross-context ContactTag link blocked';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ContactTag_context_reference_guard"
BEFORE INSERT OR UPDATE OF "contactId", "tagId" ON "ContactTag"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_contact_tag_context"();

CREATE OR REPLACE FUNCTION "relish_enforce_contact_person_subject"() RETURNS trigger AS $$
DECLARE contact_person TEXT;
BEGIN
  IF NEW."contactId" IS NOT NULL THEN
    SELECT "personId" INTO contact_person FROM "Contact" WHERE "id" = NEW."contactId";
    IF contact_person IS NOT NULL THEN
      IF NEW."personId" IS NULL THEN
        NEW."personId" := contact_person;
      ELSIF NEW."personId" <> contact_person THEN
        RAISE EXCEPTION 'Subject mismatch: contact % resolves to Person %, not %', NEW."contactId", contact_person, NEW."personId";
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE "Interaction" x SET "personId" = c."personId"
FROM "Contact" c
WHERE x."contactId" = c."id" AND x."personId" IS NULL AND c."personId" IS NOT NULL;
DO $$ DECLARE bad_count BIGINT; BEGIN
  SELECT COUNT(*) INTO bad_count FROM "Interaction" x JOIN "Contact" c ON c."id" = x."contactId"
  WHERE x."contactId" IS NOT NULL AND x."personId" IS NOT NULL AND c."personId" IS NOT NULL AND x."personId" <> c."personId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Interaction has % Contact/Person subject mismatch(es)', bad_count; END IF;
END $$;
CREATE TRIGGER "Interaction_contact_person_subject_guard"
BEFORE INSERT OR UPDATE OF "contactId", "personId" ON "Interaction"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_contact_person_subject"();
UPDATE "Objective" x SET "personId" = c."personId"
FROM "Contact" c
WHERE x."contactId" = c."id" AND x."personId" IS NULL AND c."personId" IS NOT NULL;
DO $$ DECLARE bad_count BIGINT; BEGIN
  SELECT COUNT(*) INTO bad_count FROM "Objective" x JOIN "Contact" c ON c."id" = x."contactId"
  WHERE x."contactId" IS NOT NULL AND x."personId" IS NOT NULL AND c."personId" IS NOT NULL AND x."personId" <> c."personId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Objective has % Contact/Person subject mismatch(es)', bad_count; END IF;
END $$;
CREATE TRIGGER "Objective_contact_person_subject_guard"
BEFORE INSERT OR UPDATE OF "contactId", "personId" ON "Objective"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_contact_person_subject"();
UPDATE "KnowledgeClaim" x SET "personId" = c."personId"
FROM "Contact" c
WHERE x."contactId" = c."id" AND x."personId" IS NULL AND c."personId" IS NOT NULL;
DO $$ DECLARE bad_count BIGINT; BEGIN
  SELECT COUNT(*) INTO bad_count FROM "KnowledgeClaim" x JOIN "Contact" c ON c."id" = x."contactId"
  WHERE x."contactId" IS NOT NULL AND x."personId" IS NOT NULL AND c."personId" IS NOT NULL AND x."personId" <> c."personId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: KnowledgeClaim has % Contact/Person subject mismatch(es)', bad_count; END IF;
END $$;
CREATE TRIGGER "KnowledgeClaim_contact_person_subject_guard"
BEFORE INSERT OR UPDATE OF "contactId", "personId" ON "KnowledgeClaim"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_contact_person_subject"();
UPDATE "Want" x SET "personId" = c."personId"
FROM "Contact" c
WHERE x."contactId" = c."id" AND x."personId" IS NULL AND c."personId" IS NOT NULL;
DO $$ DECLARE bad_count BIGINT; BEGIN
  SELECT COUNT(*) INTO bad_count FROM "Want" x JOIN "Contact" c ON c."id" = x."contactId"
  WHERE x."contactId" IS NOT NULL AND x."personId" IS NOT NULL AND c."personId" IS NOT NULL AND x."personId" <> c."personId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Want has % Contact/Person subject mismatch(es)', bad_count; END IF;
END $$;
CREATE TRIGGER "Want_contact_person_subject_guard"
BEFORE INSERT OR UPDATE OF "contactId", "personId" ON "Want"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_contact_person_subject"();
UPDATE "Offer" x SET "personId" = c."personId"
FROM "Contact" c
WHERE x."contactId" = c."id" AND x."personId" IS NULL AND c."personId" IS NOT NULL;
DO $$ DECLARE bad_count BIGINT; BEGIN
  SELECT COUNT(*) INTO bad_count FROM "Offer" x JOIN "Contact" c ON c."id" = x."contactId"
  WHERE x."contactId" IS NOT NULL AND x."personId" IS NOT NULL AND c."personId" IS NOT NULL AND x."personId" <> c."personId";
  IF bad_count > 0 THEN RAISE EXCEPTION 'Stage 8.6 aborted: Offer has % Contact/Person subject mismatch(es)', bad_count; END IF;
END $$;
CREATE TRIGGER "Offer_contact_person_subject_guard"
BEFORE INSERT OR UPDATE OF "contactId", "personId" ON "Offer"
FOR EACH ROW EXECUTE FUNCTION "relish_enforce_contact_person_subject"();

COMMIT;

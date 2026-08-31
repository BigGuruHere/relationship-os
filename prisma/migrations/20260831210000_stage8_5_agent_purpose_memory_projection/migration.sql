-- Stage 8.5 - Agent purpose/access + derived MemoryProjection
-- Data safety: additive only. No relationship records are deleted or rewritten.

ALTER TABLE "public"."AgentDefinition"
  ADD COLUMN "personaKey" TEXT NOT NULL DEFAULT 'assistant',
  ADD COLUMN "purposeKey" TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN "deploymentScope" TEXT NOT NULL DEFAULT 'workspace_internal',
  ADD COLUMN "authorityLevel" TEXT NOT NULL DEFAULT 'advisory';

CREATE TABLE "public"."AgentDataAccessPolicy" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentDefinitionId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL DEFAULT 'workspace_visible',
  "allowContacts" BOOLEAN NOT NULL DEFAULT false,
  "allowCompanies" BOOLEAN NOT NULL DEFAULT false,
  "allowDeals" BOOLEAN NOT NULL DEFAULT false,
  "allowProjects" BOOLEAN NOT NULL DEFAULT false,
  "allowPeople" BOOLEAN NOT NULL DEFAULT false,
  "allowIdentity" BOOLEAN NOT NULL DEFAULT false,
  "allowContactMethods" BOOLEAN NOT NULL DEFAULT false,
  "allowInteractions" BOOLEAN NOT NULL DEFAULT false,
  "allowKnowledgeClaims" BOOLEAN NOT NULL DEFAULT false,
  "allowObjectives" BOOLEAN NOT NULL DEFAULT false,
  "allowWants" BOOLEAN NOT NULL DEFAULT false,
  "allowOffers" BOOLEAN NOT NULL DEFAULT false,
  "allowRelationships" BOOLEAN NOT NULL DEFAULT false,
  "allowIntroductions" BOOLEAN NOT NULL DEFAULT false,
  "allowOutcomes" BOOLEAN NOT NULL DEFAULT false,
  "allowTasks" BOOLEAN NOT NULL DEFAULT false,
  "maxRecentInteractions" INTEGER NOT NULL DEFAULT 8,
  "maxKnowledgeClaims" INTEGER NOT NULL DEFAULT 20,
  "maxObjectives" INTEGER NOT NULL DEFAULT 12,
  "maxWants" INTEGER NOT NULL DEFAULT 12,
  "maxOffers" INTEGER NOT NULL DEFAULT 12,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentDataAccessPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentDataAccessPolicy_agentDefinitionId_key"
  ON "public"."AgentDataAccessPolicy"("agentDefinitionId");
CREATE INDEX "AgentDataAccessPolicy_userId_idx"
  ON "public"."AgentDataAccessPolicy"("userId");
CREATE INDEX "AgentDataAccessPolicy_userId_scopeKey_idx"
  ON "public"."AgentDataAccessPolicy"("userId", "scopeKey");

ALTER TABLE "public"."AgentDataAccessPolicy"
  ADD CONSTRAINT "AgentDataAccessPolicy_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."AgentDataAccessPolicy"
  ADD CONSTRAINT "AgentDataAccessPolicy_agentDefinitionId_fkey"
  FOREIGN KEY ("agentDefinitionId") REFERENCES "public"."AgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- IT: Give known built-in agents explicit purpose/deployment metadata. Unknown/custom agents keep
-- conservative defaults and receive no relationship-data access until a policy is configured.
UPDATE "public"."AgentDefinition"
SET "personaKey" = CASE "key"
      WHEN 'broker_brief_agent' THEN 'broker_analyst'
      WHEN 'opportunity_scoring_agent' THEN 'opportunity_analyst'
      WHEN 'contact_enrichment_agent' THEN 'relationship_researcher'
      WHEN 'outreach_agent' THEN 'broker_outreach_assistant'
      ELSE "personaKey"
    END,
    "purposeKey" = CASE "key"
      WHEN 'broker_brief_agent' THEN 'broker_briefing'
      WHEN 'opportunity_scoring_agent' THEN 'opportunity_scoring'
      WHEN 'contact_enrichment_agent' THEN 'contact_enrichment'
      WHEN 'outreach_agent' THEN 'broker_outreach'
      ELSE "purposeKey"
    END,
    "deploymentScope" = 'workspace_internal',
    "authorityLevel" = CASE "key"
      WHEN 'contact_enrichment_agent' THEN 'propose_only'
      WHEN 'outreach_agent' THEN 'propose_and_operational'
      ELSE 'advisory'
    END;

-- IT: Deterministic ids are valid String primary keys and make this migration idempotent in intent.
INSERT INTO "public"."AgentDataAccessPolicy" (
  "id", "userId", "agentDefinitionId", "scopeKey",
  "allowContacts", "allowCompanies", "allowDeals", "allowProjects", "allowPeople",
  "allowIdentity", "allowContactMethods", "allowInteractions", "allowKnowledgeClaims",
  "allowObjectives", "allowWants", "allowOffers", "allowRelationships",
  "allowIntroductions", "allowOutcomes", "allowTasks",
  "maxRecentInteractions", "maxKnowledgeClaims", "maxObjectives", "maxWants", "maxOffers",
  "updatedAt"
)
SELECT
  ad."id" || ':data-access', ad."userId", ad."id", 'workspace_visible',
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','contact_enrichment_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','contact_enrichment_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','contact_enrichment_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','contact_enrichment_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','contact_enrichment_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','opportunity_scoring_agent','outreach_agent') THEN true ELSE false END,
  CASE WHEN ad."key" IN ('broker_brief_agent','outreach_agent') THEN true ELSE false END,
  8, 20, 12, 12, 12, CURRENT_TIMESTAMP
FROM "public"."AgentDefinition" ad
ON CONFLICT ("agentDefinitionId") DO NOTHING;

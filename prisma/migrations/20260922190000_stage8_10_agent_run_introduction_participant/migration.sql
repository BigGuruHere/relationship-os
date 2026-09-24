-- PURPOSE: Allow a Dating Outcome agent run to reference its exact IntroductionParticipant.
-- SECURITY: The participant remains subject to the same fail-closed ContextSpace custody check as every other AgentRunEntity target.

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
    WHEN 'introduction_participant' THEN SELECT "contextSpaceId" INTO entity_context FROM "IntroductionParticipant" WHERE "id" = entity_id;
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
    'want','offer','objective','knowledge_claim','interaction','introduction','introduction_participant','outcome','market_lead',
    'project_workstream','company_contact','deal_contact','deal_company','person'
  ]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- DATA FIX: Earlier Stage 8.10 attempts could create an ApprovalRequest before the unsupported
-- participant audit link failed. Close only those pending Dating reviews whose source run failed.
UPDATE "ApprovalRequest" AS approval
SET
  "status" = 'rejected',
  "rejectedAt" = COALESCE(approval."rejectedAt", CURRENT_TIMESTAMP),
  "reviewerNote" = COALESCE(
    approval."reviewerNote",
    'Automatically closed after the Stage 8.10 participant audit-link failure.'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "AgentRun" AS run
WHERE approval."agentRunId" = run."id"
  AND approval."actionType" = 'dating_outcome_review'
  AND approval."status" = 'pending'
  AND run."status" = 'failed';

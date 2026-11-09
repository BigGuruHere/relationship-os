-- ONE-TIME EMPTY-INSTALL RESET, NOT INDIVIDUAL ACCOUNT DELETION.
-- Deletes ALL local application data, including account-owned agent/provider bindings.
-- Preserves schema, extensions and _prisma_migrations. Does not contact external services.
-- Select the correct Neon DEVELOPMENT branch; current_database() cannot identify a Neon branch.
-- Stop application/workers before the committing run, restart afterward to clear in-memory sessions/jobs.
-- First run inspect-test-reset.sql and independently verify the branch and snapshot.
-- Fill the four placeholders below. The default ROLLBACK rehearses without saving changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;
CREATE TEMP TABLE relish_reset_input (
  expected_database text NOT NULL,
  expected_accounts integer NOT NULL,
  expected_fingerprint text NOT NULL,
  confirmation text NOT NULL
) ON COMMIT DROP;
INSERT INTO relish_reset_input VALUES (
  'REPLACE_DATABASE_NAME', 18, 'REPLACE_ACCOUNT_FINGERPRINT', 'REPLACE_CONFIRMATION'
);
CREATE TEMP TABLE relish_reset_inventory (table_name text PRIMARY KEY, before_rows bigint, after_rows bigint) ON COMMIT DROP;

DO $reset$
DECLARE
  expected_tables text[] := ARRAY[
    'AgentArtifact',
    'AgentDataAccessPolicy',
    'AgentDefinition',
    'AgentPromptVersion',
    'AgentProviderBinding',
    'AgentRun',
    'AgentRunEntity',
    'AgentStep',
    'AgentToolCall',
    'AgentToolDefinition',
    'AgentToolPermission',
    'ApprovalRequest',
    'Company',
    'CompanyContact',
    'CompanyContactNote',
    'CompanyExternalIdentifier',
    'CompanyNote',
    'CompanyRelationship',
    'CompanyTag',
    'Contact',
    'ContactEnrichment',
    'ContactRelationship',
    'ContactTag',
    'ContextSpace',
    'Deal',
    'DealCompany',
    'DealContact',
    'DealContactNote',
    'DealNote',
    'DorianAgentConfigSnapshot',
    'DorianCallRecoveryEvent',
    'DorianVoiceCallLifecycle',
    'FoundationAccountAssociation',
    'FoundationAccountChannel',
    'FoundationAccountChannelChallenge',
    'FoundationAccountChannelDispatch',
    'FoundationAccountChannelVerification',
    'FoundationClaimBudget',
    'FoundationContext',
    'FoundationContextAssociation',
    'FoundationEnrollment',
    'FoundationEvidenceSegment',
    'FoundationEvidenceSubject',
    'FoundationExchange',
    'FoundationExchangeChallenge',
    'FoundationExchangeDispatch',
    'FoundationMembership',
    'FoundationPerspective',
    'FoundationSource',
    'FoundationSourceVersion',
    'FoundationStatement',
    'FoundationStatementSubject',
    'FoundationStatementVersion',
    'FoundationSubject',
    'FoundationSupport',
    'FoundationVault',
    'GovernedUnderstandingScope',
    'GovernedUnderstandingScopeSource',
    'Interaction',
    'InteractionEmbedding',
    'Introduction',
    'IntroductionParticipant',
    'InviteToken',
    'KnowledgeClaim',
    'KnowledgeEvidence',
    'Lead',
    'LeadNextActionOption',
    'LeadSource',
    'LivingUnderstandingDraft',
    'LivingUnderstandingRevision',
    'LivingUnderstandingRevisionSource',
    'LivingUnderstandingRevisionTopic',
    'LivingUnderstandingSourceReviewDisposition',
    'LivingUnderstandingTopicIdentity',
    'LivingUnderstandingTopicVersion',
    'LivingUnderstandingTopicVersionSource',
    'MagicToken',
    'MarketLead',
    'MarketLeadNote',
    'ModelInvocation',
    'NetworkConnectionOrigin',
    'NetworkConnectionVisibility',
    'NetworkDorianSession',
    'NetworkPhoneCaller',
    'OAuthAccount',
    'Objective',
    'Offer',
    'OfferNote',
    'OpportunityScore',
    'OpportunityScoreFactor',
    'Outcome',
    'PasswordLoginThrottle',
    'PasswordResetToken',
    'Person',
    'PilotBrowserSession',
    'PilotConnectionRequest',
    'PilotProfileEntry',
    'PilotSmsInvitation',
    'PilotSmsOptOut',
    'ProductEvent',
    'Profile',
    'Project',
    'ProjectDeal',
    'ProjectNote',
    'ProjectWorkstream',
    'Relating',
    'RelatingParticipant',
    'RelishCallPolicyAcceptance',
    'RelishContextPreference',
    'RelishEventPilotSignup',
    'RelishPolicySmsDispatch',
    'Reminder',
    'ResearchCandidate',
    'ResearchSource',
    'Session',
    'Subscription',
    'Tag',
    'TagAlias',
    'Task',
    'Touchpoint',
    'TouchpointParticipant',
    'UnderstandingRealm',
    'UnderstandingTopic',
    'UnderstandingTopicClaim',
    'User',
    'UserCapabilityGrant',
    'Want',
    'WantNote'
  ];
  actual_tables text[];
  table_list text;
  target_table text;
  row_count bigint;
  actual_accounts integer;
  actual_fingerprint text;
  migration_fingerprint text;
  input record;
BEGIN
  SELECT * INTO STRICT input FROM pg_temp.relish_reset_input;
  IF input.confirmation <> 'ERASE ALL DISPOSABLE RELISH DATA' OR
     input.expected_database <> current_database() OR
     input.expected_accounts < 1 OR
     input.expected_fingerprint !~ '^[a-f0-9]{32}$' THEN
    RAISE EXCEPTION 'Reset not confirmed for this database and reviewed inventory';
  END IF;
  -- Exclude migration-ledger writes before checking migration and schema state.
  LOCK TABLE public._prisma_migrations IN SHARE MODE;
  -- Refuse new/unknown tables rather than silently expanding a destructive operation.
  SELECT array_agg(c.relname::text ORDER BY c.relname::text COLLATE "C") INTO actual_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname <> '_prisma_migrations';
  IF actual_tables IS DISTINCT FROM expected_tables THEN
    RAISE EXCEPTION 'Application table inventory changed; review the reset against this schema';
  END IF;
  IF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) THEN
    RAISE EXCEPTION 'An unfinished migration requires review before reset';
  END IF;
  -- Explicit RESTRICT prevents deletion from reaching an unreviewed referencing table.
  SELECT string_agg(format('public.%I', t), ', ' ORDER BY t) INTO table_list FROM unnest(expected_tables) t;
  EXECUTE 'LOCK TABLE ' || table_list || ' IN ACCESS EXCLUSIVE MODE';
  SELECT md5(coalesce(string_agg(to_jsonb(m)::text, ',' ORDER BY id), '')) INTO migration_fingerprint
  FROM public._prisma_migrations m;
  SELECT count(*)::int, md5(coalesce(string_agg(id || ':' || "createdAt"::text, ',' ORDER BY id), ''))
    INTO actual_accounts, actual_fingerprint FROM public."User";
  IF actual_accounts <> input.expected_accounts OR actual_fingerprint <> input.expected_fingerprint THEN
    RAISE EXCEPTION 'Accounts changed since the reviewed inventory; nothing was reset';
  END IF;
  FOREACH target_table IN ARRAY expected_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', target_table) INTO row_count;
    INSERT INTO pg_temp.relish_reset_inventory VALUES (target_table, row_count, NULL);
  END LOOP;
  -- All known dependencies are named together. No FK disabling, CASCADE or migration edits.
  EXECUTE 'TRUNCATE TABLE ' || table_list || ' CONTINUE IDENTITY RESTRICT';
  FOREACH target_table IN ARRAY expected_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', target_table) INTO row_count;
    IF row_count <> 0 THEN RAISE EXCEPTION 'Reset left application records'; END IF;
    UPDATE pg_temp.relish_reset_inventory i SET after_rows = row_count WHERE i.table_name = target_table;
  END LOOP;
  IF migration_fingerprint IS DISTINCT FROM (
    SELECT md5(coalesce(string_agg(to_jsonb(m)::text, ',' ORDER BY id), '')) FROM public._prisma_migrations m
  ) THEN RAISE EXCEPTION 'Migration history changed during reset'; END IF;
END
$reset$;
SELECT * FROM pg_temp.relish_reset_inventory ORDER BY table_name;
-- Rehearsal default. Change ONLY this final ROLLBACK to COMMIT for the approved real reset.
ROLLBACK;

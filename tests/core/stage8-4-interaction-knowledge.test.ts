// tests/core/stage8-4-interaction-knowledge.test.ts
// PURPOSE: Lock down Stage 8.4 channel-neutral interactions, claim/evidence reconciliation and reviewed structured promotion.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260831193000_stage8_4_interaction_knowledge_pipeline/migration.sql', 'utf8');
const coreInteractions = readFileSync('src/lib/server/core/interactions.ts', 'utf8');
const coreKnowledge = readFileSync('src/lib/server/core/knowledge.ts', 'utf8');
const contactInteractionCreate = readFileSync('src/routes/contacts/[id]/interactions/new/+page.server.ts', 'utf8');
const interactionDetail = readFileSync('src/routes/contacts/[id]/interactions/[iid]/+page.server.ts', 'utf8');
const knowledgeDetail = readFileSync('src/routes/knowledge/[id]/+page.server.ts', 'utf8');
const contactPage = readFileSync('src/routes/contacts/[id]/+page.server.ts', 'utf8');

function modelBlock(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] || '';
}

test('Interaction is channel-neutral while preserving workspace custody', () => {
  const block = modelBlock('Interaction');
  assert.match(block, /userId String/);
  assert.match(block, /contactId String\?/);
  assert.match(block, /personId String\?/);
  assert.match(block, /companyId String\?/);
  assert.match(block, /sourceType InteractionSourceType/);
  assert.match(block, /externalRef String\?/);
  assert.match(schema, /enum InteractionSourceType \{[\s\S]*WORKSPACE[\s\S]*AGENT[\s\S]*EMAIL_CONNECTOR[\s\S]*API[\s\S]*OTHER[\s\S]*\}/);
});

test('migration backfills Person identity and requires every Interaction to retain a subject', () => {
  assert.match(migration, /UPDATE "public"\."Interaction" i[\s\S]*SET "personId" = c\."personId"/);
  assert.match(migration, /ALTER COLUMN "contactId" DROP NOT NULL/);
  assert.match(migration, /Interaction_subject_required/);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE/i);
});

test('KnowledgeClaim and KnowledgeEvidence separate current understanding from source history', () => {
  const claim = modelBlock('KnowledgeClaim');
  const evidence = modelBlock('KnowledgeEvidence');
  assert.match(claim, /statementEnc String/);
  assert.match(claim, /statementIdx String/);
  assert.match(claim, /authority\s+KnowledgeAuthority/);
  assert.match(claim, /confidence KnowledgeConfidence/);
  assert.match(claim, /evidence KnowledgeEvidence\[\]/);
  assert.match(evidence, /sourceInteractionId String\?/);
  assert.match(evidence, /authority\s+KnowledgeAuthority/);
  assert.match(evidence, /confidence\s+KnowledgeConfidence/);
  assert.match(evidence, /noteEnc\s+String\?/);
});

test('claim equality index is scoped and encrypted statement remains authoritative', () => {
  assert.match(coreKnowledge, /buildScopedIndexToken\(statement, 'knowledge:claim:statement'\)/);
  assert.match(coreKnowledge, /encrypt\(statement, 'knowledge\.claim_statement'\)/);
});

test('same active claim from another interaction appends evidence rather than duplicating the statement', () => {
  assert.match(coreKnowledge, /prisma\.knowledgeClaim\.findFirst/);
  assert.match(coreKnowledge, /status: 'ACTIVE'/);
  assert.match(coreKnowledge, /statementIdx/);
  assert.match(coreKnowledge, /prisma\.knowledgeEvidence\.findFirst/);
  assert.match(coreKnowledge, /prisma\.knowledgeEvidence\.create/);
});

test('Objective is first-class and reuses the neutral lifecycle rather than workflow task/deal state', () => {
  const block = modelBlock('Objective');
  assert.match(block, /status IntentStatus/);
  assert.match(block, /titleEnc\s+String/);
  assert.match(block, /sourceInteractionId String\?/);
  assert.match(block, /knowledgeClaims KnowledgeClaim\[\]/);
  assert.doesNotMatch(block, /taskId|dealStatus|pipeline/);
});

test('structured promotion is reviewed and type-safe', () => {
  assert.match(coreKnowledge, /if \(claim\.kind !== params\.target\)/);
  assert.match(coreKnowledge, /createWantFromForm/);
  assert.match(coreKnowledge, /createOfferFromForm/);
  assert.match(coreKnowledge, /prisma\.objective\.create/);
  assert.match(migration, /KnowledgeClaim_one_structured_target/);
});

test('existing contact note creation now uses the common Core ingestion seam', () => {
  assert.match(contactInteractionCreate, /createCoreInteraction/);
  assert.match(contactInteractionCreate, /createWorkspaceCoreAccess/);
  assert.doesNotMatch(contactInteractionCreate, /prisma\.interaction\.create/);
});

test('Core interaction ingestion validates canonical subjects before creating a record', () => {
  assert.match(coreInteractions, /findCoreContact/);
  assert.match(coreInteractions, /findCoreCompany/);
  assert.match(coreInteractions, /findAccessibleCorePerson/);
  assert.match(coreInteractions, /An Interaction requires an accessible Contact, Person, or Company subject/);
});

test('private Interaction embedding is explicitly not treated as a network-match embedding', () => {
  assert.match(coreInteractions, /sensitive derived data and is not a future network-match embedding/);
  assert.match(coreInteractions, /upsertInteractionEmbedding/);
});

test('Interaction detail provides one-step reviewed capture while Claim status is managed on the universal Claim detail surface', () => {
  assert.match(interactionDetail, /captureAndPromoteKnowledgeFromInteraction/);
  assert.match(interactionDetail, /promoteKnowledgeClaim/);
  assert.match(knowledgeDetail, /setKnowledgeClaimStatus/);
});

test('Contact Workspace surfaces structured Objectives and active KnowledgeClaims separately from notes', () => {
  assert.match(contactPage, /loadContactObjectives/);
  assert.match(contactPage, /loadContactKnowledge/);
});

test('Want and Offer carry canonical Person subject identity without weakening workspace custody', () => {
  assert.match(modelBlock('Want'), /personId String\?/);
  assert.match(modelBlock('Offer'), /personId String\?/);
  assert.match(migration, /UPDATE "public"\."Want" w[\s\S]*SET "personId" = c\."personId"/);
  assert.match(migration, /UPDATE "public"\."Offer" o[\s\S]*SET "personId" = c\."personId"/);
  assert.match(coreKnowledge, /personId: claim\.personId/);
});

// IT: Stage 8.4.2 must retire the old contact-only Interaction index so Prisma does not
// generate a machine-local drift migration after Stage 8.4 is applied.
test('Stage 8.4.2 retires the legacy Interaction contact-only index', () => {
  const hotfixMigration = readFileSync(
    'prisma/migrations/20260831194500_stage8_4_2_remove_legacy_interaction_contact_index/migration.sql',
    'utf8'
  );
  assert.match(hotfixMigration, /DROP INDEX IF EXISTS "public"\."Interaction_contactId_idx";/);

  const interactionModel = modelBlock('Interaction');
  assert.match(interactionModel, /@@index\(\[userId, contactId\]\)/);
  assert.doesNotMatch(interactionModel, /@@index\(\[contactId\]\)/);
});

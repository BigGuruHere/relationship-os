// tests/core/stage8-4-3-relationship-intelligence-ux.test.ts
// PURPOSE: Lock down the Stage 8.4.3 one-step Relationship Intelligence UX and independent Claim/Evidence status model.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260831201500_stage8_4_3_relationship_intelligence_ux/migration.sql', 'utf8');
const coreKnowledge = readFileSync('src/lib/server/core/knowledge.ts', 'utf8');
const interactionServer = readFileSync('src/routes/contacts/[id]/interactions/[iid]/+page.server.ts', 'utf8');
const interactionPage = readFileSync('src/routes/contacts/[id]/interactions/[iid]/+page.svelte', 'utf8');
const claimServer = readFileSync('src/routes/knowledge/[id]/+page.server.ts', 'utf8');
const claimPage = readFileSync('src/routes/knowledge/[id]/+page.svelte', 'utf8');
const relationshipPanel = readFileSync('src/lib/RelationshipIntelligencePanel.svelte', 'utf8');
const objectivePage = readFileSync('src/routes/objectives/[id]/+page.svelte', 'utf8');
const contactServer = readFileSync('src/routes/contacts/[id]/+page.server.ts', 'utf8');

function modelBlock(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] || '';
}

test('Evidence status is first-class and independent from Claim status', () => {
  const evidence = modelBlock('KnowledgeEvidence');
  assert.match(evidence, /status\s+KnowledgeClaimStatus\s+@default\(ACTIVE\)/);
  assert.match(evidence, /@@index\(\[userId, claimId, status\]\)/);
  assert.match(coreKnowledge, /setKnowledgeEvidenceStatus/);
  assert.match(coreKnowledge, /deliberately does not silently retire the Claim/);
});

test('8.4.3 migration preserves all existing evidence as active and is non-destructive', () => {
  assert.match(migration, /ADD COLUMN "status" "public"\."KnowledgeClaimStatus" NOT NULL DEFAULT 'ACTIVE'/);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i);
});

test('structured relationship intelligence is captured and promoted with one reviewed action', () => {
  assert.match(coreKnowledge, /captureAndPromoteKnowledgeFromInteraction/);
  assert.match(coreKnowledge, /captureKnowledgeFromInteraction/);
  assert.match(coreKnowledge, /promoteKnowledgeClaim/);
  assert.match(interactionServer, /captureAndPromoteKnowledgeFromInteraction/);
});

test('interaction capture pre-fills from source evidence and no longer requires a second title entry', () => {
  assert.match(interactionPage, /interaction\.summary \|\| interaction\.text/);
  assert.match(interactionPage, /bind:value=\{statementDraft\}/);
  assert.match(interactionPage, /Create offer/);
  assert.doesNotMatch(interactionPage, /Short \$\{claim\.kind\.toLowerCase\(\)\} title/);
});

test('provenance remains available but is collapsed out of the normal capture path', () => {
  assert.match(interactionPage, /<details class="advanced">/);
  assert.match(interactionPage, /Advanced provenance/);
});

test('every claim has a universal detail route with claim status controls', () => {
  assert.match(claimServer, /loadKnowledgeClaim/);
  assert.match(claimServer, /setKnowledgeClaimStatus/);
  assert.match(claimPage, /Claim status/);
  assert.match(claimPage, /Supersede claim/);
  assert.match(claimPage, /Reject claim/);
  assert.match(claimPage, /Restore claim/);
});

test('claim detail exposes evidence status separately and supports evidence retirement/restoration', () => {
  assert.match(claimServer, /setKnowledgeEvidenceStatus/);
  assert.match(claimPage, /Evidence status:/);
  assert.match(claimPage, /Supersede evidence/);
  assert.match(claimPage, /Reject evidence/);
  assert.match(claimPage, /Restore evidence/);
});

test('active claims with no active evidence are surfaced instead of looking normal', () => {
  assert.match(coreKnowledge, /activeEvidenceCount/);
  assert.match(coreKnowledge, /hasActiveEvidence/);
  assert.match(claimPage, /active claim has no active supporting evidence/);
  assert.match(relationshipPanel, /No active evidence/);
});

test('Facts and all other active knowledge are clickable from the Contact panel', () => {
  assert.match(relationshipPanel, /href=\{`\/knowledge\/\$\{claim\.id\}`\}/);
  assert.match(relationshipPanel, /claim-item/);
});

test('Objectives show when linked claims have been retired instead of appearing normally supported', () => {
  assert.match(coreKnowledge, /activeClaimCount/);
  assert.match(coreKnowledge, /activeSupportedClaimCount/);
  assert.match(objectivePage, /No active supporting claims/);
  assert.match(objectivePage, /href=\{`\/knowledge\/\$\{claim\.id\}`\}/);
});


test('superseded and rejected claims remain reachable from Contact knowledge history', () => {
  assert.match(coreKnowledge, /loadContactKnowledgeHistory/);
  assert.match(contactServer, /loadContactKnowledgeHistory/);
  assert.match(relationshipPanel, /Knowledge history/);
  assert.match(relationshipPanel, /Superseded and rejected claims remain available/);
});

// tests/core/stage8-5-agent-memory.test.ts
// PURPOSE: Lock down Stage 8.5 agent purpose/access separation and derived memory projections.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260831210000_stage8_5_agent_purpose_memory_projection/migration.sql', 'utf8');
const setup = readFileSync('src/lib/server/agents/agentSetup.ts', 'utf8');
const access = readFileSync('src/lib/server/core/agentDataAccess.ts', 'utf8');
const memory = readFileSync('src/lib/server/core/agentMemory.ts', 'utf8');
const readContext = readFileSync('src/lib/server/agents/tools/readEntityContext.ts', 'utf8');
const readMemory = readFileSync('src/lib/server/agents/tools/readAgentMemory.ts', 'utf8');
const registry = readFileSync('src/lib/server/agents/toolRegistry.ts', 'utf8');
const intentCommon = readFileSync('src/lib/server/intentCommon.ts', 'utf8');
const previewServer = readFileSync('src/routes/agents/memory/+page.server.ts', 'utf8');
const previewPage = readFileSync('src/routes/agents/memory/+page.svelte', 'utf8');

function modelBlock(name: string) {
  return schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] || '';
}

test('AgentDefinition formalises persona, purpose, deployment and authority without making them permissions', () => {
  const block = modelBlock('AgentDefinition');
  assert.match(block, /personaKey\s+String/);
  assert.match(block, /purposeKey\s+String/);
  assert.match(block, /deploymentScope\s+String/);
  assert.match(block, /authorityLevel\s+String/);
  assert.match(block, /dataAccessPolicy\s+AgentDataAccessPolicy\?/);
});

test('relationship-data access is a separate fail-closed policy from tool permission', () => {
  const block = modelBlock('AgentDataAccessPolicy');
  assert.match(block, /agentDefinitionId String\s+@unique/);
  assert.match(block, /allowContactMethods\s+Boolean @default\(false\)/);
  assert.match(block, /allowInteractions\s+Boolean @default\(false\)/);
  assert.match(block, /allowKnowledgeClaims\s+Boolean @default\(false\)/);
  assert.match(block, /allowWants\s+Boolean @default\(false\)/);
  assert.match(block, /allowOffers\s+Boolean @default\(false\)/);
  assert.doesNotMatch(block, /permissionLevel|requiresApproval/);
});

test('Stage 8.5 migration is additive and does not rewrite relationship truth', () => {
  assert.match(migration, /CREATE TABLE "public"\."AgentDataAccessPolicy"/);
  assert.match(migration, /ADD COLUMN "purposeKey"/);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i);
});

test('known built-in agents are backfilled with explicit purpose and conservative authority metadata', () => {
  for (const value of ['broker_briefing', 'opportunity_scoring', 'contact_enrichment', 'broker_outreach']) {
    assert.match(migration, new RegExp(value));
  }
  assert.match(migration, /propose_only/);
  assert.match(migration, /propose_and_operational/);
});

test('future built-in agent setup persists both agent profile and data-access policy', () => {
  assert.match(setup, /personaKey: cfg\.personaKey/);
  assert.match(setup, /purposeKey: cfg\.purposeKey/);
  assert.match(setup, /prisma\.agentDataAccessPolicy\.upsert/);
  assert.match(setup, /scopeKey: 'workspace_visible'/);
});

test('existing read_entity_context loads policy and delegates to the fail-closed entity projection', () => {
  assert.match(readContext, /loadAgentAccessProfile\(access\)/);
  assert.match(readContext, /buildAgentEntityContextProjection/);
  assert.doesNotMatch(readContext, /filterEntityContextForAgentPolicy/);
});

test('legacy post-query compatibility filtering has been retired', () => {
  assert.doesNotMatch(access, /filterEntityContextForAgentPolicy/);
  assert.match(readContext, /No post-query filtering/);
});

test('MemoryProjection is derived rather than persisted as another source-of-truth model', () => {
  assert.doesNotMatch(schema, /model MemoryProjection\s*\{/);
  assert.match(memory, /sourceOfTruth: 'RELISH_CORE'/);
  assert.match(memory, /persisted: false/);
  assert.match(memory, /This is rebuilt from canonical Core records/);
});

test('derived memory loads only workspace-scoped active/current relationship intelligence sections', () => {
  assert.match(memory, /userId: context\.workspaceUserId/);
  assert.match(memory, /if \(policy\.allowContactMethods\) \{/);
  assert.match(memory, /Object\.assign\(contactSelect, \{ emailEnc: true, phoneEnc: true, linkedinEnc: true \}\)/);
  assert.match(memory, /userId, status: 'ACTIVE'/);
  assert.match(memory, /allowKnowledgeClaims \? \{ knowledgeClaims:/);
  assert.match(memory, /allowObjectives \? \{ objectives:/);
  assert.match(memory, /allowWants \? \{ wants:/);
  assert.match(memory, /allowOffers \? \{ offers:/);
});

test('read_agent_memory is a registered audited tool that produces a derived projection', () => {
  assert.match(readMemory, /buildAgentMemoryProjection/);
  assert.match(readMemory, /role: 'memory_input'/);
  assert.match(registry, /registerAgentTool\(readAgentMemoryTool\)/);
  assert.match(setup, /key: 'read_agent_memory'/);
});

test('canonical Person continuity can resolve Wants and Offers without requiring a Contact-only link', () => {
  assert.match(intentCommon, /if \(links\.personId\) where\.personId = links\.personId/);
  assert.match(intentCommon, /if \(links\.personId\) data\.personId = null/);
  assert.match(memory, /if \(personId\) OR\.push\(\{ personId \}\)/);
});

test('Workspace includes a read-only memory preview to inspect what each agent is permitted to see', () => {
  assert.match(previewServer, /buildAgentMemoryProjection/);
  assert.match(previewServer, /purpose: 'workspace_memory_preview'/);
  assert.match(previewPage, /Derived, not stored/);
  assert.match(previewPage, /Inspect permitted projection/);
});

// tests/core/agent-core-boundary.test.ts
// PURPOSE: Ensure relationship-data access in agent tools starts at the Stage 8.1 scoped Core repository boundary.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const relationshipRepo = readFileSync('src/lib/server/core/relationshipRepository.ts', 'utf8');
const scopedRepo = readFileSync('src/lib/server/core/scopedRepository.ts', 'utf8');
const readContext = readFileSync('src/lib/server/agents/tools/readEntityContext.ts', 'utf8');
const entityProjection = readFileSync('src/lib/server/core/agentEntityProjection.ts', 'utf8');
const createTask = readFileSync('src/lib/server/agents/tools/createTask.ts', 'utf8');
const createEnrichment = readFileSync('src/lib/server/agents/tools/createContactEnrichment.ts', 'utf8');
const createResearchSource = readFileSync('src/lib/server/agents/tools/createResearchSource.ts', 'utf8');
const createScore = readFileSync('src/lib/server/agents/tools/createOpportunityScore.ts', 'utf8');

test('Core relationship repository applies workspace scoping through one shared primitive', () => {
  assert.match(relationshipRepo, /createScopedRelationshipRepository/);
  assert.match(scopedRepo, /userId: required\(context\.workspaceUserId/);
  assert.match(scopedRepo, /findContact:/);
  assert.match(scopedRepo, /findCompany:/);
  assert.match(scopedRepo, /findDeal:/);
  assert.match(scopedRepo, /findProject:/);
});

test('read_entity_context delegates to a fail-closed Core projection backed by scoped repositories', () => {
  assert.match(readContext, /buildAgentEntityContextProjection/);
  assert.match(entityProjection, /findCoreContact\(/);
  assert.match(entityProjection, /findCoreCompany\(/);
  assert.match(entityProjection, /findCoreDeal\(/);
  assert.match(entityProjection, /findCoreProject\(/);
  assert.doesNotMatch(readContext, /prisma\.(contact|company|deal|project)\.(findFirst|findUnique|findMany)/);
});


test('agent tool directory has no direct canonical relationship reads outside the Core repository', () => {
  const files = readdirSync('src/lib/server/agents/tools').filter((name) => name.endsWith('.ts'));
  for (const file of files) {
    const source = readFileSync(`src/lib/server/agents/tools/${file}`, 'utf8');
    assert.doesNotMatch(
      source,
      /prisma\.(contact|company|deal|project)\.(findFirst|findUnique|findMany)/,
      `${file} must not bypass the scoped Core relationship repository`
    );
  }
});
test('agent writes validate canonical foreign keys through the Core boundary', () => {
  for (const [name, source] of [
    ['createTask', createTask],
    ['createContactEnrichment', createEnrichment],
    ['createResearchSource', createResearchSource],
    ['createOpportunityScore', createScore]
  ] as const) {
    assert.match(source, /createAgentCoreAccess\(/, `${name} must create an agent access context`);
    assert.match(source, /assertOwnedCanonicalRefs\(/, `${name} must validate canonical references`);
  }
});

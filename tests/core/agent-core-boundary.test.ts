// tests/core/agent-core-boundary.test.ts
// PURPOSE: Ensure relationship-data access in agent tools starts at the Stage 8.1 scoped Core repository boundary.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const relationshipRepo = readFileSync('src/lib/server/core/relationshipRepository.ts', 'utf8');
const readContext = readFileSync('src/lib/server/agents/tools/readEntityContext.ts', 'utf8');
const createTask = readFileSync('src/lib/server/agents/tools/createTask.ts', 'utf8');
const createEnrichment = readFileSync('src/lib/server/agents/tools/createContactEnrichment.ts', 'utf8');
const createResearchSource = readFileSync('src/lib/server/agents/tools/createResearchSource.ts', 'utf8');
const createScore = readFileSync('src/lib/server/agents/tools/createOpportunityScore.ts', 'utf8');

test('Core relationship repository applies workspace scoping to canonical entity reads', () => {
  assert.match(relationshipRepo, /workspaceEntityWhere\(context, contactId\)/);
  assert.match(relationshipRepo, /workspaceEntityWhere\(context, companyId\)/);
  assert.match(relationshipRepo, /workspaceEntityWhere\(context, dealId\)/);
  assert.match(relationshipRepo, /workspaceEntityWhere\(context, projectId\)/);
});

test('read_entity_context uses scoped Core repositories rather than direct canonical Prisma reads', () => {
  assert.match(readContext, /findCoreContact\(/);
  assert.match(readContext, /findCoreCompany\(/);
  assert.match(readContext, /findCoreDeal\(/);
  assert.match(readContext, /findCoreProject\(/);
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

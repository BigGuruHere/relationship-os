// Regression: the browser must expose the same chronological rule enforced by the server.
// Static inspection does not replace live database or browser acceptance tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const service = read('../../src/lib/server/datingKnowledgeComparison.ts');
const knowledge = read('../../src/lib/server/datingLivingUnderstanding.ts');
const route = read('../../src/routes/dating/people/[id]/understanding/+page.server.ts');
const ui = read('../../src/routes/dating/people/[id]/understanding/+page.svelte');

test('current knowledge returns immutable entry date separately from last update', () => {
  assert.match(knowledge, /createdAt: true, updatedAt: true/);
  assert.match(knowledge, /createdAt: row\.createdAt, updatedAt: row\.updatedAt/);
  assert.match(route, /createdAt: namedKnowledge\.find\(item => item\.id === candidate\.id\)\?\.createdAt/);
});
test('server rejects backwards retirement and maintains scoped transactional history', () => {
  assert.match(service, /newer\.createdAt < older\.createdAt/);
  assert.match(service, /id: input\.olderClaimId, \.\.\.scope, status: 'ACTIVE'/);
  assert.match(service, /status: 'SUPERSEDED'/);
});
test('browser shows entry dates and prevents backwards retirement with swap control', () => {
  assert.match(ui, /comparisonChronologyInvalid/);
  assert.match(ui, /disabled=\{comparisonChronologyInvalid\}/);
  assert.match(ui, /reverseComparison/);
  assert.match(ui, /Entered in Relish/);
  assert.match(ui, /Entry dates may differ from when a real-world change occurred/);
});

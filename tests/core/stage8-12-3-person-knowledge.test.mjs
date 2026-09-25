// Stage 8.12.3 focused source and validation checks. Live behaviour is covered by the opt-in PostgreSQL test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const service = readFileSync('src/lib/server/datingLivingUnderstanding.ts', 'utf8');
const route = readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts', 'utf8');
const ui = readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');
const history = readFileSync('src/routes/dating/people/[id]/+page.svelte', 'utf8');
test('an existing personal reflection can be selected as a proposed knowledge source', () => {
  assert.match(history, /understanding\?sourceInteractionId=/);
  assert.match(route, /requireSourceReflection\(scope, sourceId\)/);
  assert.match(service, /channel: 'DATING_PERSON_REFLECTION'/);
  assert.match(service, /contactId: scope\.contactId/);
});
test('review retains original provenance and supports individual knowledge types', () => {
  assert.match(service, /const kind = validateDatingKnowledgeKind/);
  assert.match(service, /sourceInteractionId: origin\.sourceInteractionId/);
  assert.match(service, /const retiredEvidence = \[\.\.\.priorEvidence, \.\.\.originEvidence\]/);
  assert.match(service, /authority: 'THIRD_PARTY_REPORTED'/);
});
test('current knowledge is a bounded scoped claim view, not a transcript reconstruction', () => {
  assert.match(service, /export async function listCurrentDatingKnowledge/);
  assert.match(service, /knowledgeClaim\.findMany/);
  assert.match(service, /status: 'ACTIVE'/);
  assert.match(service, /take: 150/);
  assert.match(ui, /Current knowledge/);
});
test('manual pilot review does not grant person confirmation or disclosure authority', () => {
  assert.match(ui, /Operator review is not participant confirmation or sharing consent/);
  assert.match(service, /requireOwnedDatingContact/);
  assert.match(route, /contextDomainKey !== 'dating'/);
});

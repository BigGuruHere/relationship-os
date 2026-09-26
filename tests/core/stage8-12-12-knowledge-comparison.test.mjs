// Stage 8.12.12: execute the pure candidate/validation functions and inspect server boundaries.
// These tests do NOT replace live database custody, route or browser acceptance tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/lib/server/datingKnowledgeComparison.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/+page.server.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/+page.svelte', import.meta.url), 'utf8');
// Import via data URL to exercise the actual pure functions without loading database secrets.
const { validateComparison, sharedTopicCandidates } = await import('../../src/lib/server/datingKnowledgeComparisonPolicy.ts');
const one = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const two = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const three = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('only shared-topic, distinct, active candidate IDs are assembled', () => {
  const tree = [{ topics: [
    { id: 'romance', name: 'Relationship readiness', claims: [{ id: one }, { id: two }] },
    { id: 'friendships', name: 'Friendships', claims: [{ id: two }, { id: three }] },
    { id: 'family', name: 'Family', claims: [{ id: one }, { id: three }] }
  ] }];
  assert.deepEqual(sharedTopicCandidates(tree, one), [{ id: two, topics: ['Relationship readiness'] }, { id: three, topics: ['Family'] }]);
  assert.deepEqual(sharedTopicCandidates([{ topics: [] }], one), []);
});
test('operator must explicitly acknowledge retirement; malformed pair rejected', () => {
  assert.throws(() => validateComparison({ newerClaimId: one, olderClaimId: two, relationship: 'SUPERSEDES' }), /acknowledge/);
  assert.equal(validateComparison({ newerClaimId: one, olderClaimId: two, relationship: 'SUPERSEDES', acknowledgeSupersession: true }).relationship, 'SUPERSEDES');
  assert.throws(() => validateComparison({ newerClaimId: one, olderClaimId: one, relationship: 'SUPPORTS' }), /distinct/);
  assert.throws(() => validateComparison({ newerClaimId: one, olderClaimId: two, relationship: 'SECRET' }), /valid/);
});
test('comparisons are explicit and scope both active claims plus a shared-topic link before writes', () => {
  assert.match(source, /await requireDatingPerson\(scope\)/);
  assert.match(source, /id: input\.newerClaimId, \.\.\.scope, status: 'ACTIVE'/);
  assert.match(source, /id: input\.olderClaimId, \.\.\.scope, status: 'ACTIVE'/);
  assert.match(source, /newerTopicIds\.has\(link\.topicId\)/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /encrypt\(JSON\.stringify\(entry\), AAD\)/);
  assert.match(source, /status: 'SUPERSEDED'/);
  assert.doesNotMatch(source, /console\.log\(/);
});
test('UI shows both statements, original source, explicit retirement and comparison history', () => {
  assert.match(route, /compareDatingKnowledge\(scope/);
  assert.match(ui, /Compare new knowledge with earlier understanding/);
  assert.match(ui, /Read its original private reflection/);
  assert.match(ui, /Retire earlier statement/);
  assert.match(ui, /acknowledgeSupersession/);
  assert.match(ui, /Recorded comparisons/);
});

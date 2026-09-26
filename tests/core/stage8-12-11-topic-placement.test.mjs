// Stage 8.12.11: real executable deterministic placement policy plus route safety/UX guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suggestTopicPlacement } from '../../src/lib/server/datingTopicPlacement.ts';
const route = readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/+page.server.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/+page.svelte', import.meta.url), 'utf8');
const topics = [
  { id: 'one', realmKey: 'romantic_relationships', realmName: 'Romantic relationships', name: 'Desired relationship' },
  { id: 'two', realmKey: 'friendships', realmName: 'Friendships and social life', name: 'Social preferences' }
];
test('distinct romantic readiness remains separately suggested from desired relationship', () => {
  const wishes = suggestTopicPlacement('I want a romantic relationship.', 'WANT', topics);
  const uncertainty = suggestTopicPlacement('I am not sure I am ready to commit to a serious relationship.', 'CONSTRAINT', topics);
  assert.equal(wishes[0].topicId, 'one');
  assert.ok(uncertainty.some(row => row.topicName === 'Relationship readiness' && row.isNew));
});
test('prefers a relevant existing topic and supports independent multi-topic decisions', () => {
  const hints = suggestTopicPlacement('I prefer smaller social groups when making friends.', 'PREFERENCE', topics);
  assert.ok(hints.some(hint => hint.topicId === 'two' && hint.isNew === false));
  assert.ok(hints.every(hint => hint.reason.length > 15));
});
test('does not invent placements for unsupported statements, and makes no writes', () => {
  assert.deepEqual(suggestTopicPlacement('The train arrived yesterday.', 'FACT', topics), []);
  assert.doesNotMatch(suggestTopicPlacement.toString(), /prisma|fetch\(|console\.log/);
});
test('selected claim is custody-scoped before topic creation and explicit before assignment', () => {
  assert.match(route, /knowledgeClaim\.findFirst\(\{ where: \{ id: claimId, \.\.\.scope, status: 'ACTIVE'/);
  assert.match(route, /await assignKnowledgeTopic\(scope, claimId, topic\.id\)/);
  assert.match(ui, /Read the original private reflection/);
  assert.match(ui, /Create topic and assign/);
  assert.match(ui, /Choose another existing topic/);
  assert.match(ui, /Nothing is assigned or created until you choose an action/);
});

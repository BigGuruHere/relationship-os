import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const persistence = fs.readFileSync('src/lib/server/datingPersistedLivingUnderstanding.ts', 'utf8');

test('8.13.2.1 keeps source re-authorisation inside the authoritative transaction', () => {
  assert.match(persistence, /Re-authorise every source inside the same transaction/);
  assert.match(persistence, /requireSourceReflection\(scope, id, tx\)/);
});

test('8.13.2.1 batches revision, topic-version provenance and membership writes', () => {
  assert.match(persistence, /livingUnderstandingRevisionSource\.createMany/);
  assert.match(persistence, /livingUnderstandingTopicVersion\.createMany/);
  assert.match(persistence, /livingUnderstandingTopicVersionSource\.createMany/);
  assert.match(persistence, /livingUnderstandingRevisionTopic\.createMany/);
});

test('8.13.2.1 resolves new topic identities set-wise instead of one upsert per topic', () => {
  assert.match(persistence, /livingUnderstandingTopicIdentity\.findMany/);
  assert.match(persistence, /livingUnderstandingTopicIdentity\.createMany/);
  assert.doesNotMatch(persistence, /livingUnderstandingTopicIdentity\.upsert/);
});

test('8.13.2.1 retains carry-forward and stale-baseline invariants', () => {
  assert.match(persistence, /topicVersionId: prior\.topicVersionId/);
  assert.match(persistence, /STALE_BASELINE/);
  assert.match(persistence, /adoptionKey/);
});

test('8.13.2.1 gives the atomic save a pooled-database safety margin', () => {
  assert.match(persistence, /ADOPTION_TRANSACTION_TIMEOUT_MS = 45_000/);
  assert.match(persistence, /timeout: ADOPTION_TRANSACTION_TIMEOUT_MS/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('src/lib/server/datingLongitudinalLivingUnderstanding.ts', 'utf8');
const persisted = fs.readFileSync('src/lib/server/datingPersistedLivingUnderstanding.ts', 'utf8');
const route = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.server.ts', 'utf8');
const page = fs.readFileSync('src/routes/dating/people/[id]/understanding/impact-review/+page.svelte', 'utf8');
const home = fs.readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');

test('8.13.1 production impact analysis starts from authoritative persisted revision membership', () => {
  assert.match(service, /getAuthoritativeLivingUnderstandingBaseline\(scope\)/);
  assert.doesNotMatch(service, /listUnderstandingTopics/);
  assert.match(service, /topicIdentityId/);
  assert.match(service, /topicVersionId/);
});

test('8.13.1 requires exhaustive stable topic identities and target-speaker evidence', () => {
  assert.match(service, /For EVERY supplied topicIdentityId return exactly one topicEffects row/);
  assert.match(service, /seen\.size !== baseline\.topics\.length/);
  assert.match(service, /lacks valid target-speaker evidence/);
});

test('8.13.1 regenerates only affected topics and carries unchanged versions in persistence', () => {
  assert.match(service, /if \(item\.effect === 'UNCHANGED'\)/);
  assert.match(service, /if \(item\.effect !== 'REINFORCED'\)/);
  assert.match(persisted, /topicVersionId: prior\.topicVersionId/);
  assert.match(persisted, /affected topics alone receive a new immutable topic version/);
});

test('8.13.1 approval is signed, baseline-bound, source-bound and idempotent through persistence', () => {
  assert.match(service, /REVIEW_TOKEN_SCOPE/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /persistence transaction itself is the/);
  assert.match(persisted, /STALE_BASELINE/);
  assert.match(service, /sourceAlreadyInAuthoritativeLivingUnderstanding/);
  assert.match(service, /persistLongitudinalLivingUnderstandingRevision/);
  assert.match(persisted, /Idempotency is checked before stale-baseline detection/);
});

test('8.13.1 production route binds working checkpoint to source and authoritative baseline', () => {
  assert.match(route, /IMPACT_REVIEW_READY/);
  assert.match(route, /sourceInteractionId,/);
  assert.match(route, /baselineRevisionId: proposal\.baselineRevisionId/);
  assert.match(route, /baselineRevisionNumber: proposal\.baselineRevisionNumber/);
  assert.match(route, /completeLivingUnderstandingDraft/);
});

test('8.13.1 UI exposes production impact review instead of rebuild when an authoritative baseline exists', () => {
  assert.match(home, /Review impact on Living Understanding/);
  assert.match(home, /impact-review\?sourceInteractionId/);
  assert.match(page, /Affected topics/);
  assert.match(page, /Unchanged topics carried forward/);
  assert.match(page, /Approve and create v/);
  assert.match(page, /grants no matching, disclosure or sharing permission/);
});

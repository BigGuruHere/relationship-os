// Stage 8.12.0.1: executable no-op policy plus static custody/UI regression checks.
// These tests do not replace the opt-in PostgreSQL integration test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldAppendUnderstandingReview } from '../../src/lib/server/understandingReviewPolicy.ts';
const service = readFileSync('src/lib/server/datingLivingUnderstanding.ts', 'utf8');
const route = readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts','utf8');
const ui = readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte','utf8');
test('unchanged confirmation is idempotent, genuine changes create history', () => {
  const old = { statement:'Enjoys walking', decision:'CONFIRMED', note:'' };
  assert.equal(shouldAppendUnderstandingReview(old, { ...old }), false);
  assert.equal(shouldAppendUnderstandingReview(old, { ...old, note:' ' }), false);
  assert.equal(shouldAppendUnderstandingReview(old, { ...old, statement:'Enjoys walking with friends' }), true);
  assert.equal(shouldAppendUnderstandingReview(old, { ...old, decision:'DEFERRED' }), true);
  assert.equal(shouldAppendUnderstandingReview(old, { ...old, note:'Reconsidered this morning' }), true);
  assert.equal(shouldAppendUnderstandingReview(null, old), true);
});
test('initial confirmation and source are one transaction', () => {
  assert.match(service, /export async function createDatingUnderstanding/);
  assert.match(service, /await prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(service, /if \(decision\) await appendUnderstandingReview\(tx/);
  assert.match(route, /decision: String\(form\.get\('decision'\)/);
});
test('per-proposal locking and fail-closed ownership remain', () => {
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(service, /ownerUserId: scope\.userId, domainKey: 'dating'/);
  assert.match(service, /externalRef: `understanding:proposal:\$\{proposalId\}`/);
  assert.match(service, /shouldAppendUnderstandingReview/);
});
test('operator authority stays distinct from participant confirmation', () => {
  assert.match(service, /actor: 'OPERATOR'/);
  assert.match(service, /authority: 'THIRD_PARTY_REPORTED'/);
  assert.match(ui, /not independently verified by the participant/);
  assert.match(ui, /does not grant permission/);
});
test('list has explicit Edit and History, not a permanently open form', () => {
  assert.match(ui, /editingId === item\.id/);
  assert.match(ui, /Close edit.*Edit/);
  assert.match(ui, /<details class="history-panel">/);
  assert.match(ui, /Save proposal/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { recoveryEligibility } from '../../src/lib/server/pilotMonitor/dorianRecoveryPolicy.ts';

const minutesAgo = n => new Date(Date.now() - n * 60000);
const actions = (state, mins, evidence = false) => recoveryEligibility(state, minutesAgo(mins), evidence, Date.now()).actions;

test('active calls cannot be released just because a monitor page was loaded', () => {
  assert.deepEqual(actions('IN_CALL', 10, false), []);
  assert.deepEqual(actions('WORKING', 10, true), []);
  assert.deepEqual(actions('QUEUED', 60, true), []);
});
test('an abandoned call without evidence can be released but never retried', () => {
  assert.deepEqual(actions('IN_CALL', 16, false), ['RELEASE']);
  assert.deepEqual(actions('IN_CALL', 16, true), ['RETRY', 'RELEASE']);
});
test('failed processing can retry only with verified source; release is always explicit', () => {
  assert.deepEqual(actions('FAILED', 5, false), ['RELEASE']);
  assert.deepEqual(actions('FAILED', 5, true), ['RETRY', 'RELEASE']);
});
test('a working job can only be marked failed after a long stall, never directly released or retried', () => {
  assert.deepEqual(actions('WORKING', 65, true), ['MARK_FAILED']);
});
test('queued work is not cancelled during ordinary worker lag', () => {
  assert.deepEqual(actions('PROCESSING', 121, true), ['RELEASE']);
  assert.deepEqual(actions('QUEUED', 121, true), ['RELEASE']);
  assert.deepEqual(actions('READY', 999, true), []);
});
test('mutations are scoped to operator-owned binding and perform a CAS with an audit in one transaction', () => {
  const code = readFileSync('src/lib/server/pilotMonitor/dorianRecovery.ts', 'utf8');
  assert.match(code, /userId: viewer\.userId, contextSpaceId: viewer\.contextSpaceId, provider: 'ELEVENLABS'/);
  assert.match(code, /id: input\.sessionId, agentBindingId: \{ in: bindings \}/);
  assert.match(code, /await prisma\.\$transaction\(async tx =>/);
  assert.match(code, /understandingConversationId: session\.conversationId/);
  assert.match(code, /understandingStateAt: changedAt/);
  assert.match(code, /isolationLevel: 'Serializable'/);
  assert.match(code, /await tx\.dorianCallRecoveryEvent\.create/);
  assert.match(code, /confirmedWorkerStopped/);
  assert.match(code, /confirmedEnded/);
  assert.match(code, /RELEASED_UNPROCESSED/);
});
test('monitor includes no-transcript sessions, presents operator-only actions and history', () => {
  const server = readFileSync('src/routes/general/admin/dorian-conversations/+page.server.ts', 'utf8');
  const svelte = readFileSync('src/routes/general/admin/dorian-conversations/+page.svelte', 'utf8');
  assert.match(server, /requirePilotOperator\(locals\)/);
  assert.match(server, /recoverDorianCall\(viewer/);
  assert.match(svelte, /item\.hasEvidence/);
  assert.match(svelte, /Apply audited recovery/);
  assert.match(svelte, /Recent recovery actions/);
  assert.ok(existsSync('prisma/migrations/20261028170000_stage8_20_1_dorian_call_recovery/migration.sql'));
});
test('recovery does not rewrite the existing automatic learning pipeline', () => {
  const code = readFileSync('src/lib/server/pilotMonitor/dorianRecovery.ts', 'utf8');
  assert.doesNotMatch(code, /adoptLivingUnderstanding\(/);
  assert.doesNotMatch(code, /processPhoneUnderstanding\(/);
  assert.doesNotMatch(code, /phoneEnc|phoneIndex|rawTextEnc|transcriptText/);
});

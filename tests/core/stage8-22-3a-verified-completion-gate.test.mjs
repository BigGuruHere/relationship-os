// Stage 8.22.3a safety contracts. These are source-level checks, not live provider tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const webhook = read('src/routes/api/webhooks/elevenlabs/+server.ts');
const gate = read('src/lib/server/core/phoneUnderstandingAutomation.ts');
const ledger = read('src/lib/server/core/dorianVoiceCallLifecycle.ts');
const initiation = read('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
const monitor = read('src/lib/server/pilotMonitor/dorianRecovery.ts');

test('signed completion reaches the provider-independent call lifecycle service before any LU processing', () => {
  // All caller-state transitions follow a verified event, never a provider API GET.
  const complete = webhook.indexOf('await recordVerifiedVoiceCallEnded({');
  const empty = webhook.indexOf('if (!spokenRows)');
  assert.ok(complete > 0 && complete < empty);
  const adapter = read('src/lib/server/core/voiceCallEvents.ts');
  assert.match(adapter, /await completeDorianCall\(input\.conversationId, input\.hasParticipantSpeech, input\.endedAt\)/);
  assert.match(adapter, /await markPhoneCallEnded\(input\.conversationId, input\.endedAt\)/);
});
test('provider supplied actual completion time is preferred over callback receipt time', () => {
  assert.match(webhook, /metadata\?\.end_time_unix_secs/);
  assert.match(webhook, /endTimeIsValid \? new Date\(endTimeSeconds \* 1000\) : new Date\(\)/);
});
test('a confirmed ending moves the matching caller out of physical IN_CALL state', () => {
  assert.match(gate, /understandingConversationId: conversationId, understandingState: 'IN_CALL'/);
  assert.match(gate, /understandingState: 'AWAITING_INGEST'/);
  assert.match(gate, /understandingCallEndedAt: endedAt/);
});
test('empty transcript always closes the same caller gate', () => {
  const empty = webhook.indexOf('if (!spokenRows)');
  const next = webhook.indexOf('return json({ status:', empty);
  assert.match(webhook.slice(empty, next), /releasePhoneContinuityWithoutUnderstanding\(event\.data\.conversation_id\)/);
  assert.match(gate, /where:\{understandingConversationId:conversationId\}/);
});
test('a signed ended unlinked call releases its gate without importing private evidence', () => {
  const begin = webhook.indexOf("if (deployment.agentKey === 'DORIAN' && !shared)");
  const end = webhook.indexOf("// Stage 8.19", begin);
  assert.ok(begin > 0 && end > begin);
  const branch = webhook.slice(begin, end);
  assert.match(branch, /finishPhoneUnderstanding\(normalized\.metadata\.externalConversationId, 'FAILED'\)/);
  assert.match(branch, /unlinked_phone_call/);
});
test('consent-refused calls release without claiming LU completed', () => {
  const begin = webhook.indexOf('if (shared && conversationalPolicyEnabled()');
  const end = webhook.indexOf('const targetUserId', begin);
  assert.match(webhook.slice(begin, end), /releasePhoneContinuityWithoutUnderstanding\(normalized\.metadata\.externalConversationId\)/);
});
test('empty calls are never falsely marked understanding COMPLETED', () => {
  assert.match(ledger, /understandingState: \{ in: eligiblePriorStates \}/);
});
test('post-claim initiation failures release their own lock', () => {
  const begin = initiation.indexOf('const response = provisionalPhoneInitiationResponse(prepared)');
  const end = initiation.indexOf('return runWithExternalWorkspaceCustody', begin);
  assert.match(initiation.slice(begin, end), /finishPhoneUnderstanding\(String\(body\?\.conversation_id \|\| ''\), 'FAILED'\)/);
});
test('operator screen exposes provider call state and understanding state separately', () => {
  assert.match(monitor, /export async function listRecentDorianProviderCalls/);
  assert.match(monitor, /callState: true, understandingState: true/);
  const ui = read('src/routes/general/admin/dorian-conversations/+page.svelte');
  assert.match(ui, /Provider call lifecycle \(latest 40\)/);
  assert.match(ui, /Continuity gate: <strong>\{item.state\}<\/strong>/);
});
test('ten minute timeout continues to use verified completion, not call initiation', () => {
  assert.match(gate, /PHONE_CONTINUITY_WINDOW_MS = 10 \* 60 \* 1000/);
  assert.match(gate, /understandingCallEndedAt: \{ lte: cutoff \}/);
});

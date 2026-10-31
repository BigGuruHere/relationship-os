// Stage 8.22.3c: executable Relish continuity decisions plus integration wiring contracts.
// These tests use local source and deterministic timestamps, never provider APIs or databases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { continuityAction, unconfirmedCallLeaseExpired,
  UNCONFIRMED_ACTIVE_CALL_LEASE_MS, COMPLETED_CALL_UNDERSTANDING_WINDOW_MS
} from '../../src/lib/server/core/phoneContinuityPolicy.mjs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const at = iso => new Date(iso);
const end = at('2026-10-31T04:00:00.000Z');

test('completed meaningful call waits during its ten minute understanding window', () => {
  const call = {callState:'ENDED', understandingState:'PENDING', endedAt:end};
  assert.equal(continuityAction(call, at('2026-10-31T04:09:59.999Z')), 'WAIT_PROCESSING');
  assert.equal(continuityAction(call, at('2026-10-31T04:10:00.000Z')), 'EXPIRE_PROCESSING');
  assert.equal(COMPLETED_CALL_UNDERSTANDING_WINDOW_MS, 10*60*1000);
});

test('completed and failed LU release immediately without waiting ten minutes', () => {
  for (const understandingState of ['COMPLETED','FAILED','NOT_REQUIRED','EXPIRED']) {
    assert.equal(continuityAction({callState:'ENDED', understandingState, endedAt:end},
      at('2026-10-31T04:00:01.000Z')), 'RELEASE');
  }
});

test('an active 90-minute call cannot start a ten-minute processing deadline', () => {
  const call = { callState:'STARTED', startedAt: at('2026-10-31T03:00:00.000Z') };
  assert.equal(continuityAction(call, at('2026-10-31T04:30:00.000Z')), 'WAIT_ACTIVE');
  assert.equal(continuityAction(call, at('2026-10-31T05:00:00.000Z')), 'ABANDON_UNCONFIRMED');
  assert.equal(UNCONFIRMED_ACTIVE_CALL_LEASE_MS, 2*60*60*1000);
});

test('unconfirmed-call fall-back never invents an end timestamp', () => {
  assert.equal(unconfirmedCallLeaseExpired(null, at('2026-10-31T05:00:00.000Z')), false);
  assert.equal(continuityAction({callState:'UNCONFIRMED'}), 'RELEASE');
  const source = read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  assert.match(source, /callState: 'UNCONFIRMED'/);
  assert.match(source, /reason: 'MISSING_COMPLETION_EVENT'/);
  assert.doesNotMatch(source, /fetchElevenLabsConversation|ELEVENLABS_API_KEY/);
});

test('provider-neutral verified completion is recorded before any LU work', () => {
  const bridge = read('src/lib/server/core/voiceCallEvents.ts');
  const webhook = read('src/routes/api/webhooks/elevenlabs/+server.ts');
  assert.match(bridge, /await completeDorianCall\(input.conversationId/);
  assert.match(webhook, /await recordVerifiedVoiceCallEnded\(\{/);
  assert.ok(webhook.indexOf('await recordVerifiedVoiceCallEnded({') <
    webhook.indexOf('if (!spokenRows)'));
});

test('worker cannot start until transcript ingestion has committed', () => {
  const gate = read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  const webhook = read('src/routes/api/webhooks/elevenlabs/+server.ts');
  const worker = read('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
  assert.match(gate, /understandingState: 'AWAITING_INGEST'/);
  // Stage 8.22.4: the gate is acquired after ended participant evidence, not at initiation.
  assert.match(gate, /call\?\.callState !== 'ENDED'/);
  assert.match(worker, /where: \{ understandingState: 'PROCESSING'/);
  assert.ok(webhook.indexOf('const ingested = await') < webhook.indexOf('await beginPhoneUnderstanding('));
});

test('late webhook cannot clear a newer caller lock and can close an UNCONFIRMED ledger row', () => {
  const gate = read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  const ledger = read('src/lib/server/core/dorianVoiceCallLifecycle.ts');
  assert.match(gate, /understandingConversationId: conversationId/);
  assert.match(ledger, /callState: \{ in: \['STARTED', 'UNCONFIRMED'\] \}/);
});

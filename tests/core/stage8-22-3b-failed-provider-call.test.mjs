// Stage 8.22.3b behavior retained through the provider-neutral stage 8.22.3c adapter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const webhook = read('src/routes/api/webhooks/elevenlabs/+server.ts');
const adapter = read('src/lib/server/core/voiceCallEvents.ts');
const gate = read('src/lib/server/core/phoneUnderstandingAutomation.ts');

test('a signed call initiation failure closes its own call and releases its gate', () => {
  const signed = webhook.indexOf('if (!signatureCheck.valid)');
  const failure = webhook.indexOf("if (event?.type === 'call_initiation_failure')");
  const otherEvents = webhook.indexOf("if (event?.type !== 'post_call_transcription')");
  assert.ok(signed > 0 && failure > signed && otherEvents > failure);
  const branch = webhook.slice(failure, otherEvents);
  assert.match(branch, /recordVerifiedVoiceCallEnded\(\{ conversationId: failedConversationId/);
  assert.match(branch, /releasePhoneContinuityWithoutUnderstanding\(failedConversationId\)/);
});

test('signed post-call event closes the ledger even if it has zero participant turns', () => {
  assert.match(webhook, /hasParticipantSpeech: false/);
  assert.match(webhook, /if \(!spokenRows\)/);
  assert.match(webhook, /releasePhoneContinuityWithoutUnderstanding\(event\.data\.conversation_id\)/);
  assert.match(adapter, /completeDorianCall\(input\.conversationId, input\.hasParticipantSpeech, input\.endedAt\)/);
});

test('caller release always matches the exact prior conversation', () => {
  assert.match(gate, /where:\s*\{\s*understandingConversationId: conversationId\s*\}/);
  assert.match(gate, /understandingConversationId: previousConversationId/);
});

test('no provider status lookup is used by the continuity gate', () => {
  assert.doesNotMatch(gate, /fetchElevenLabsConversation|ELEVENLABS_API_KEY/);
  const onboarding = read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  assert.match(onboarding, /reconcilePhoneContinuityFromLocalLedger\(caller.id\)/);
  assert.doesNotMatch(onboarding, /reconcileUnconfirmedPhoneCall/);
});

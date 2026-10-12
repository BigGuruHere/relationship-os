// Stage 8.14.2.5 - ElevenLabs HMAC parity/diagnostics + current test participant default.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inspectElevenLabsSignature, verifyElevenLabsSignature } from '../../src/lib/server/integrations/elevenlabs/conversation.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const webhook = read('../../src/routes/api/webhooks/elevenlabs/+server.ts');
const harness = read('../../src/routes/settings/agents/test/+page.server.ts');
const vite = read('../../vite.config.ts');

function signed(body, secret, timestamp) {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v0=${digest}`;
}

test('HMAC verification matches ElevenLabs timestamp.rawBody v0 scheme and defaults to SDK 30-minute tolerance', () => {
  const body = '{"type":"post_call_transcription","data":{"conversation_id":"conv_test"}}';
  const secret = 'webhook-test-secret';
  const now = 1_800_000_000;
  const twentyMinutesAgo = now - 20 * 60;
  const header = signed(body, secret, twentyMinutesAgo);
  assert.equal(verifyElevenLabsSignature(body, header, secret, now), true);
  const inspected = inspectElevenLabsSignature(body, header, secret, now);
  assert.equal(inspected.valid, true);
  assert.equal(inspected.reason, 'OK');
  assert.equal(inspected.scheme, 'v0');
  assert.equal(inspected.ageSeconds, 1200);
});

test('HMAC diagnostics distinguish a wrong secret without logging secret material', () => {
  const body = '{"type":"post_call_transcription"}';
  const now = 1_800_000_000;
  const header = signed(body, 'correct-secret', now);
  const inspected = inspectElevenLabsSignature(body, header, 'wrong-secret', now);
  assert.equal(inspected.valid, false);
  assert.equal(inspected.reason, 'HASH_MISMATCH');
  assert.doesNotMatch(JSON.stringify(inspected), /correct-secret|wrong-secret/);
});

test('post-call route supports the current secret name, legacy compatibility fallback, and safe signature diagnostics', () => {
  assert.match(webhook, /ELEVENLABS_WEBHOOK_SECRET/);
  assert.match(webhook, /POST_CALL_WEBHOOK_SECRET/);
  assert.match(webhook, /secretSource/);
  assert.match(webhook, /signatureCheck\.reason/);
  assert.match(webhook, /ageSeconds/);
  assert.doesNotMatch(webhook, /expected.*digest|supplied.*digest/);
});

test('widget harness defaults to the current General test participant', () => {
  assert.match(harness, /e7b6f115-780d-411b-a68f-1ad3b19364e6/);
});

test('ngrok Vite host support remains included in the package', () => {
  assert.match(vite, /creative-basilisk-painfully\.ngrok-free\.app/);
  assert.match(vite, /allowedHosts/);
});

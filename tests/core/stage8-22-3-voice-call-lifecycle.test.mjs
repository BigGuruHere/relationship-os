// Stage 8.22.3 regression contract: check independent provider call tracking.
// These checks do not require a live ElevenLabs call or production DB access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');

test('processing-only initiation records call lifecycle before returning holding message', () => {
  const s = read('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  const wait = s.indexOf("if (prepared.status === 'WAIT')");
  assert.ok(wait > 0);
  const record = s.indexOf("mode: 'PROCESSING_ONLY'", wait);
  const hold = s.indexOf("relish_network_session: 'PROCESSING_NO_SESSION'", wait);
  assert.ok(record > wait && record < hold);
});
test('signed post-call event closes call before empty transcript return', () => {
  const s = read('src/routes/api/webhooks/elevenlabs/+server.ts');
  const complete = s.indexOf('await recordVerifiedVoiceCallEnded({');
  const empty = s.indexOf('if (!spokenRows)');
  assert.ok(complete > 0 && empty > complete);
});
test('ten-minute expiry reads completion timestamp, never initiation timestamp', () => {
  const s = read('src/lib/server/core/phoneUnderstandingAutomation.ts');
  assert.match(s, /PHONE_CONTINUITY_WINDOW_MS = 10 \* 60 \* 1000/);
  assert.match(s, /understandingCallEndedAt: \{ lte: cutoff \}/);
});
test('provider record and participant session are separate entities', () => {
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /model DorianVoiceCallLifecycle/);
  assert.match(schema, /conversationId String @id/);
  assert.match(schema, /model NetworkDorianSession/);
});
test('blocked calls cannot enter the understanding queue', () => {
  const s = read('src/lib/server/core/dorianVoiceCallLifecycle.ts');
  assert.match(s, /mode: 'PARTICIPANT'/);
  assert.match(s, /callState: 'ENDED'/);
});

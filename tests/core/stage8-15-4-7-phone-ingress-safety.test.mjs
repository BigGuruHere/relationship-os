import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const route = readFileSync(new URL('../../src/routes/api/webhooks/elevenlabs/+server.ts', import.meta.url), 'utf8');
const initiation = readFileSync(new URL('../../src/routes/api/webhooks/elevenlabs/initiation/+server.ts', import.meta.url), 'utf8');
test('HMAC validation remains before signed-event classification', () => {
  assert.ok(route.indexOf('if (!signatureCheck.valid)') < route.indexOf('const spokenRows'));
});
test('abandoned or empty calls are acknowledged without creating transcript', () => {
  assert.match(route, /ignored_no_participant_speech/);
  assert.ok(route.indexOf('if (!spokenRows)') < route.indexOf('normalizeElevenLabsConversation('));
});
test('shared call missing a verified session never falls back to deployment owner', () => {
  assert.match(route, /unlinked_phone_call/);
  assert.match(route, /status: 202/);
  assert.match(route, /Missing or invalid Network participant session/);
  assert.ok(route.indexOf('if (deployment.bindingId === configuredSharedBindingId() && !shared)') < route.indexOf('const targetUserId = shared?.userId'));
});
test('unsafe or unresolved shared phone initiation receives no private context', () => {
  // Stage 8.15.4.7b replaced the anonymous-only route with provisional caller custody.
  // Retain a fail-closed assertion for missing, duplicate and unsafe requests.
  assert.match(initiation, /startProvisionalPhoneCall/);
  assert.match(initiation, /if \(!prepared\)/);
  assert.match(initiation, /relish_identity_status: 'UNRESOLVED'/);
  assert.match(initiation, /Do not use or disclose prior participant information/);
});

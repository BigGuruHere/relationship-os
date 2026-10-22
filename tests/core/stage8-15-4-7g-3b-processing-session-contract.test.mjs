// Stage 8.15.4.7g.3b: blocked callers must still satisfy ElevenLabs dynamic-variable requirements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/routes/api/webhooks/elevenlabs/initiation/+server.ts', 'utf8');
const session = readFileSync('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts', 'utf8');

test('PROCESSING greeting provides a non-authorising session placeholder', () => {
  const block = route.slice(route.indexOf("if (prepared.status === 'WAIT')"), route.indexOf('const response = provisionalPhoneInitiationResponse(prepared)'));
  assert.match(block, /relish_network_session:\s*'PROCESSING_NO_SESSION'/);
  assert.match(block, /relish_identity_status:\s*'PROCESSING'/);
  assert.match(block, /end_call/);
  assert.doesNotMatch(block, /relish_network_session:\s*prepared\.token/);
});

test('READY greeting still sends a real session token', () => {
  assert.match(session, /relish_network_session:\s*input\.token/);
});

test('UNRESOLVED caller also fulfils session variable contract without issuing access', () => {
  const block = route.slice(route.indexOf('if (!prepared) {'), route.indexOf("if (prepared.status === 'WAIT')"));
  assert.match(block, /relish_network_session:\s*'UNRESOLVED_NO_SESSION'/);
});

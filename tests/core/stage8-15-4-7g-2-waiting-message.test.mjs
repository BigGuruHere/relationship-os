// Stage 8.15.4.7g.2 structural regressions for held phone calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const initiation = readFileSync('src/routes/api/webhooks/elevenlabs/initiation/+server.ts', 'utf8');
const onboarding = readFileSync('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts', 'utf8');

test('WAIT responses include a natural spoken processing notice', () => {
  assert.match(initiation, /I'm just processing our last call/);
  assert.match(initiation, /call me back in a few minutes/);
  assert.match(initiation, /first_message: waitingMessage/);
});
test('WAIT responses remain uncredentialed and instruct end_call', () => {
  const wait = initiation.slice(initiation.indexOf("if (prepared.status === 'WAIT')"), initiation.indexOf('const response = provisionalPhoneInitiationResponse(prepared)'));
  assert.match(wait, /relish_identity_status: 'PROCESSING'/);
  assert.match(wait, /end_call/);
  // Presence satisfies ElevenLabs, but the sentinel is not an issued credential.
  assert.match(wait, /relish_network_session: 'PROCESSING_NO_SESSION'/);
  assert.doesNotMatch(wait, /relish_network_session: prepared\.token/);
});
test('WAIT responses can use the scoped stored name', () => {
  assert.match(onboarding, /return \{ status: 'WAIT' as const, preferredName \}/);
  assert.match(initiation, /prepared.preferredName\?\.trim\(\)/);
});
test('valid sessions still supply their required dynamic variables', () => {
  assert.match(onboarding, /relish_network_session: input.token/);
  assert.match(onboarding, /living_understanding: input.livingContext/);
  assert.match(onboarding, /last_call_summary: input.lastCallSummary/);
});

// Verify the exact ElevenLabs initiation-variable contract for the Dorian pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/lib/server/integrations/elevenlabs/phoneOnboarding.ts', import.meta.url), 'utf8');
const response = source.slice(source.indexOf('export function provisionalPhoneInitiationResponse('));

test('initiation retains the exact session variable needed by secure tools', () => {
  assert.match(response, /relish_network_session:\s*input\.token/);
});
test('initiation uses the new Living Understanding names without old aliases', () => {
  assert.match(response, /\bliving_understanding:\s*input\.livingContext\s*\|\|\s*''/);
  assert.match(response, /\bliving_understanding_revision:\s*input\.livingRevision\s*\|\|\s*''/);
  assert.doesNotMatch(response, /\brelish_living_understanding(?:_revision)?:/);
});
test('other Dorian continuity variables remain present', () => {
  assert.match(response, /last_call_summary:\s*input\.lastCallSummary/);
  assert.match(response, /memory_and_identity_context:\s*input\.livingContext/);
  assert.match(response, /user_name:\s*input\.preferredName/);
});

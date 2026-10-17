import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');

test('shared launch prepares only the authenticated participant context', () => {
  const launch = read('lib/server/integrations/elevenlabs/networkSession.ts');
  assert.match(launch, /prepareNetworkDorianContext\(\{ userId, contextSpaceId, contactId: selfContactId \}\)/);
  assert.match(launch, /relish_network_session: token/);
  assert.match(launch, /user_id: userId/);
});
test('conversation context reads only current understanding from the participant scope', () => {
  const prep = read('lib/server/integrations/elevenlabs/networkPreparation.ts');
  assert.match(prep, /getCurrentLivingUnderstanding\(scope\)/);
  assert.match(prep, /linkedUserId: input.userId/);
  assert.match(prep, /previous_calls/);
  assert.match(prep, /memory_and_identity_context/);
});
test('signed post-call webhook still resolves ownership from token', () => {
  const webhook = read('routes/api/webhooks/elevenlabs/+server.ts');
  assert.match(webhook, /resolveSharedNetworkSession\(/);
  assert.match(webhook, /sessionToken: normalized.dynamicVariables.relish_network_session/);
  assert.match(webhook, /targetUserId = shared\?\.userId/);
});
test('participant initiation cannot expose the deployment owner LU', () => {
  const initiation = read('routes/api/webhooks/elevenlabs/initiation/+server.ts');
  assert.match(initiation, /deployment.bindingId === configuredSharedBindingId\(\)/);
  assert.match(initiation, /relish_identity_status: 'UNRESOLVED'/);
});

// Stage 8.14.2.3 - Dorian legacy dynamic-variable compatibility and flexible harness identity resolution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const initiation = read('../../src/lib/server/integrations/elevenlabs/initiation.ts');
const initiationRoute = read('../../src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
const harnessServer = read('../../src/routes/settings/agents/test/+page.server.ts');
const harnessPage = read('../../src/routes/settings/agents/test/+page.svelte');

test('initiation emits the complete existing Dorian dynamic-variable contract', () => {
  for (const key of [
    'memory_and_identity_context', 'call_instruction', 'call_type', 'user_name',
    'previous_calls', 'user_id', 'agent_id', 'last_call_summary', 'emotion_label',
    'agent_website', 'agent_type'
  ]) {
    assert.match(initiation, new RegExp(`${key}:`));
  }
});

test('legacy Dorian memory is projected from bounded Living Understanding rather than raw source text', () => {
  assert.match(initiation, /memory_and_identity_context: input\.livingUnderstanding/);
  assert.match(initiation, /slice\(0, 16\)/);
  assert.doesNotMatch(initiation, /rawTextEnc|sourceInteraction/);
});

test('provider agent id and widget-test call type are passed into compatibility variables', () => {
  assert.match(initiationRoute, /providerAgentId: body\?\.agent_id/);
  assert.match(initiationRoute, /RELISH_WIDGET_TEST_HARNESS/);
  assert.match(initiationRoute, /'WIDGET_TEST'/);
  assert.match(initiation, /agent_id: input\.compatibility\?\.providerAgentId/);
});

test('test harness accepts either custody-local Contact id or Person id and shows how it matched', () => {
  assert.match(harnessServer, /resolveHarnessParticipant/);
  assert.match(harnessServer, /where: \{ id: inputId, userId, contextSpaceId \}/);
  assert.match(harnessServer, /where: \{ personId: inputId, userId, contextSpaceId \}/);
  assert.match(harnessServer, /matchedAs: 'CONTACT_ID'/);
  assert.match(harnessServer, /matchedAs: 'PERSON_ID'/);
  assert.match(harnessPage, /Input matched as:/);
  assert.match(harnessPage, /Contact:/);
  assert.match(harnessPage, /Person:/);
});

test('test harness sends only the resolved trusted Relish identifier to initiation', () => {
  assert.match(harnessServer, /payloadIdentity: \{ relish_contact_id: exactContact\.id \}/);
  assert.match(harnessServer, /payloadIdentity: \{ relish_person_id: inputId \}/);
  assert.match(harnessServer, /\.\.\.participantResolution\.payloadIdentity/);
});

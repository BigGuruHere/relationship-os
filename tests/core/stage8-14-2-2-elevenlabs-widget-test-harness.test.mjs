// Stage 8.14.2.2 - Local widget + real initiation endpoint development harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const server = read('../../src/routes/settings/agents/test/+page.server.ts');
const page = read('../../src/routes/settings/agents/test/+page.svelte');
const admin = read('../../src/routes/settings/agents/+page.svelte');

const TEST_PERSON_ID = 'e7b6f115-780d-411b-a68f-1ad3b19364e6';

test('test harness defaults to the current test person but permits env override', () => {
  assert.match(server, /ELEVENLABS_TEST_PERSON_ID/);
  assert.match(server, new RegExp(TEST_PERSON_ID));
});

test('mock initiation traverses the public initiation endpoint without exposing the bearer secret to the browser', () => {
  assert.match(server, /ELEVENLABS_TEST_PUBLIC_ORIGIN/);
  assert.match(server, /\/api\/webhooks\/elevenlabs\/initiation/);
  assert.match(server, /ELEVENLABS_INITIATION_SECRET/);
  assert.match(server, /authorization: `Bearer \$\{secret\}`/);
  assert.doesNotMatch(page, /ELEVENLABS_INITIATION_SECRET/);
});

test('test harness uses an owned active provider binding and resolves a custody-local Contact or Person identity', () => {
  assert.match(server, /userId: locals\.user\.id/);
  assert.match(server, /provider: 'ELEVENLABS'/);
  assert.match(server, /isActive: true/);
  assert.match(server, /resolveHarnessParticipant/);
  assert.match(server, /relish_contact_id: exactContact\.id/);
  assert.match(server, /relish_person_id: inputId/);
  assert.match(server, /agent_id: agentId/);
});

test('widget receives the exact dynamic variables returned by the initiation response', () => {
  assert.match(server, /dynamicVariablesJson: JSON\.stringify\(dynamicVariables\)/);
  assert.match(page, /elevenlabs-convai/);
  assert.match(page, /agent-id=\{form\.agentId\}/);
  assert.match(page, /dynamic-variables=\{form\.dynamicVariablesJson\}/);
  assert.match(page, /convai-widget-embed/);
});

test('agent administration links to the bridge test harness', () => {
  assert.match(admin, /\/settings\/agents\/test/);
  assert.match(admin, /Test ElevenLabs bridge/);
});

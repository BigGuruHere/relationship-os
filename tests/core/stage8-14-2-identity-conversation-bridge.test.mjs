// Stage 8.14.2 - Stable Relish agent identity, replaceable ElevenLabs bindings, and pre/post-call bridge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const identity = read('../../src/lib/server/integrations/elevenlabs/identity.ts');
const deployment = read('../../src/lib/server/integrations/elevenlabs/deployment.ts');
const initiation = read('../../src/lib/server/integrations/elevenlabs/initiation.ts');
const initiationRoute = read('../../src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
const postCall = read('../../src/routes/api/webhooks/elevenlabs/+server.ts');
const conversation = read('../../src/lib/server/integrations/elevenlabs/conversation.ts');
const adminServer = read('../../src/routes/settings/agents/+page.server.ts');
const adminUi = read('../../src/routes/settings/agents/+page.svelte');
const schema = read('../../prisma/schema.prisma');
const migration = read('../../prisma/migrations/20261009023000_stage8_14_2_agent_provider_bindings/migration.sql');
const custody = read('../../src/lib/server/core/contextSpace.ts');
const db = read('../../src/lib/db.ts');

test('phone identity remains an identifier rather than person identity', () => {
  assert.match(identity, /normalizePhoneForIdentity/);
  assert.match(identity, /phoneIdx/);
  assert.match(identity, /PHONE_LEGACY_NORMALIZED/);
  assert.match(identity, /status: 'CONFLICT'/);
});

test('stable Relish agent identity is separated from replaceable provider bindings', () => {
  assert.match(schema, /model AgentProviderBinding/);
  assert.match(schema, /agentDefinitionId String/);
  assert.match(schema, /providerAgentIdEnc/);
  assert.match(schema, /providerAgentIdIdx/);
  assert.match(schema, /inboundPhoneEnc/);
  assert.match(schema, /inboundPhoneIdx/);
  assert.match(schema, /validFrom/);
  assert.match(schema, /validTo/);
  assert.match(migration, /CREATE TABLE "public"\."AgentProviderBinding"/);
});

test('deployment resolver cross-checks provider agent id and called number and fails closed on real conflicts', () => {
  assert.match(deployment, /resolveElevenLabsAgentDeployment/);
  assert.match(deployment, /providerAgentIdIdx/);
  assert.match(deployment, /inboundPhoneIdx/);
  assert.match(deployment, /AGENT_ID_AND_NUMBER/);
  assert.match(deployment, /SAME_AGENT_BINDING_DRIFT/);
  assert.match(deployment, /PROVIDER_AGENT_ID_NOT_BOUND/);
  assert.match(deployment, /status: 'CONFLICT'/);
});

test('conversation initiation derives ContextSpace from deployment instead of fixed env agent id', () => {
  assert.match(initiationRoute, /resolveElevenLabsAgentDeployment/);
  assert.match(initiationRoute, /body\?\.agent_id/);
  assert.match(initiationRoute, /body\?\.called_number/);
  assert.doesNotMatch(initiationRoute, /ELEVENLABS_AGENT_ID/);
  assert.doesNotMatch(initiationRoute, /ELEVENLABS_GENERAL_CONTEXT_SPACE_ID/);
  assert.match(initiationRoute, /ELEVENLABS_CONVERSATION_INITIATION/);
  assert.match(initiation, /ELEVENLABS_INITIATION_SECRET/);
});

test('pre-call context is bounded and carries stable Relish agent identifiers back to ElevenLabs', () => {
  assert.match(initiation, /getCurrentLivingUnderstanding/);
  assert.match(initiation, /slice\(0, 16\)/);
  assert.match(initiation, /relish_agent_binding_id/);
  assert.match(initiation, /relish_agent_definition_id/);
  assert.match(initiation, /relish_agent_key/);
  assert.match(initiation, /relish_contact_id: contact\.id/);
  assert.doesNotMatch(initiation, /rawTextEnc|sourceInteraction/);
});

test('post-call adapter extracts both caller and called numbers and uses deployment resolution first', () => {
  assert.match(conversation, /system__caller_id/);
  assert.match(conversation, /system__called_number/);
  assert.match(conversation, /calledNumber/);
  assert.match(postCall, /resolveElevenLabsAgentDeployment/);
  assert.match(postCall, /normalized\.calledNumber/);
  assert.match(postCall, /deployment\.domainKey/);
  assert.doesNotMatch(postCall, /ELEVENLABS_AGENT_ID/);
  assert.doesNotMatch(postCall, /ELEVENLABS_GENERAL_CONTEXT_SPACE_ID/);
});

test('agent admin page supports create, replace, deactivate and historical bindings', () => {
  assert.match(adminServer, /createAgent/);
  assert.match(adminServer, /createBinding/);
  assert.match(adminServer, /replaceBinding/);
  assert.match(adminServer, /deactivateBinding/);
  assert.match(adminServer, /validTo: now/);
  assert.match(adminUi, /Replace binding/);
  assert.match(adminUi, /Historical/);
  assert.match(adminUi, /Agent deployments/);
});

test('provider ids and numbers are encrypted while exact-match indexes support routing', () => {
  assert.match(adminServer, /encrypt\(input\.providerAgentId/);
  assert.match(adminServer, /encrypt\(input\.phone/);
  assert.match(adminServer, /buildScopedIndexToken\(input\.providerAgentId/);
  assert.match(adminServer, /buildScopedIndexToken\(input\.phone/);
});

test('external custody policies separately constrain initiation reads and post-call ingestion', () => {
  assert.match(custody, /ELEVENLABS_CONVERSATION_INITIATION/);
  assert.match(custody, /LivingUnderstandingRevision: new Set\(\['findFirst'\]\)/);
  assert.match(custody, /ELEVENLABS_CONVERSATION_INGEST/);
});

test('database keepalive remains opt-in', () => {
  assert.match(db, /DB_KEEPALIVE_ENABLED/);
  assert.match(db, /process\.env\.DB_KEEPALIVE_ENABLED === 'YES'/);
});

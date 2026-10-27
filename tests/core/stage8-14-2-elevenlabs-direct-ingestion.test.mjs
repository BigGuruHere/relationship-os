// Stage 8.14.2 - Direct ElevenLabs ingestion and opt-in database keepalive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { normalizeElevenLabsConversation, verifyElevenLabsSignature } from '../../src/lib/server/integrations/elevenlabs/conversation.ts';

// The test is explicit about its phone-country context; production has no default.
process.env.TELEPHONY_DEFAULT_COUNTRY = 'AU';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const webhook = read('../../src/routes/api/webhooks/elevenlabs/+server.ts');
const inbox = read('../../src/lib/server/core/conversationInbox.ts');
const generalRoute = read('../../src/routes/general/conversations/import/+page.server.ts');
const generalUi = read('../../src/routes/general/conversations/import/+page.svelte');
const db = read('../../src/lib/db.ts');
const custody = read('../../src/lib/server/core/contextSpace.ts');

test('ElevenLabs transcript becomes stable User/Agent turns without treating agent speech as participant evidence', () => {
  const normalized = normalizeElevenLabsConversation({
    conversation_id: 'conv_123', agent_id: 'agent_1', agent_name: 'Dorian',
    metadata: { start_time_unix_secs: 1700000000 },
    transcript: [
      { role: 'agent', message: 'What matters to you?' },
      { role: 'user', message: 'Meeting people more naturally.' }
    ]
  }, 'ELEVENLABS_WEBHOOK');
  assert.deepEqual(normalized.parsed.turns.map(t => [t.id, t.speaker]), [['T001','Agent'],['T002','User']]);
  assert.equal(normalized.metadata.externalConversationId, 'conv_123');
  assert.equal(normalized.metadata.provider, 'ELEVENLABS');
  assert.equal(normalized.metadata.ingestMethod, 'ELEVENLABS_WEBHOOK');
});

test('webhook HMAC validates timestamp.body and rejects bad signatures', () => {
  const secret = 'test-secret';
  const body = '{"type":"post_call_transcription"}';
  const t = 1700000000;
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  assert.equal(verifyElevenLabsSignature(body, `t=${t},v0=${sig}`, secret, t), true);
  assert.equal(verifyElevenLabsSignature(body, `t=${t},v0=${'0'.repeat(64)}`, secret, t), false);
});

test('public webhook is HMAC protected, deployment-routed, idempotent and does not run AI', () => {
  assert.match(webhook, /ELEVENLABS_POST_CALL_WEBHOOK_SECRET/);
  assert.match(webhook, /resolveElevenLabsAgentDeployment/);
  assert.doesNotMatch(webhook, /ELEVENLABS_GENERAL_CONTEXT_SPACE_ID/);
  assert.match(webhook, /post_call_transcription/);
  assert.match(webhook, /runWithExternalWorkspaceCustody/);
  assert.match(webhook, /ELEVENLABS_CONVERSATION_INGEST/);
  assert.match(inbox, /conversationExternalRef/);
  assert.match(inbox, /alreadyImported/);
  assert.doesNotMatch(webhook, /OPENAI|generateStructured|reviewLivingUnderstandingImpact|approveLivingUnderstandingImpact/);
  assert.match(webhook, /describeLivingUnderstandingReviewHandoff/);
});

test('unresolved webhook conversations can be attached explicitly or recovered through ElevenLabs API', () => {
  assert.match(generalRoute, /fetchElevenLabsConversation/);
  assert.match(generalRoute, /listPendingConversations/);
  assert.match(generalRoute, /attachPending/);
  assert.match(generalUi, /Pending ElevenLabs conversations/);
  assert.match(generalUi, /Fetch from ElevenLabs/);
  assert.match(inbox, /speakerSource\(userTurns, 'User'\)/);
});

test('external custody policy is narrow to the models direct ingestion needs', () => {
  assert.match(custody, /ELEVENLABS_CONVERSATION_INGEST/);
  assert.match(custody, /Interaction: new Set\(\['findFirst', 'create'\]\)/);
  assert.match(custody, /Contact: new Set\(\['findFirst', 'findMany'\]\)/);
});

test('database keepalive is off by default and enabled only by explicit YES flag', () => {
  assert.match(db, /DB_KEEPALIVE_ENABLED/);
  assert.match(db, /=== 'YES'/);
  assert.match(db, /if \(KEEPALIVE_ENABLED/);
  assert.match(db, /DB_KEEPALIVE_DISABLED !== 'YES'/);
});

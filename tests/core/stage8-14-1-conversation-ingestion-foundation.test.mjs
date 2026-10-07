// Stage 8.14.1: provider-aware conversation ingestion remains manual first but is ready for a direct ElevenLabs adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDatingTranscript } from '../../src/lib/server/datingTranscriptImportPolicy.ts';
import {
  buildConversationPayload,
  conversationExternalRef,
  sourceTypeForConversationIngest,
  validateConversationMetadata
} from '../../src/lib/server/core/conversationIngestion.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const importer = read('../../src/lib/server/datingTranscriptImport.ts');
const sourceService = read('../../src/lib/server/datingLivingUnderstanding.ts');
const revisionService = read('../../src/lib/server/datingUnderstandingRevisionExperiment.ts');
const importRoute = read('../../src/routes/dating/conversations/import/+page.server.ts');
const importUi = read('../../src/routes/dating/conversations/import/+page.svelte');
const personUi = read('../../src/routes/dating/people/[id]/+page.svelte');

test('speaker parsing assigns stable ordered turn IDs', () => {
  const parsed = parseDatingTranscript('User: First\nAgent: Question\nUser: Second');
  assert.deepEqual(parsed.turns.map(turn => turn.id), ['T001', 'T002', 'T003']);
  assert.deepEqual(parsed.turns.map(turn => turn.speaker), ['User', 'Agent', 'User']);
});

test('conversation metadata is provider aware and provider IDs are hashed in external refs', () => {
  const metadata = validateConversationMetadata({
    provider: 'ELEVENLABS', ingestMethod: 'ELEVENLABS_WEBHOOK', externalConversationId: 'conv_secret_123', agentName: 'Dorian'
  });
  assert.equal(metadata.provider, 'ELEVENLABS');
  assert.equal(metadata.ingestMethod, 'ELEVENLABS_WEBHOOK');
  assert.equal(sourceTypeForConversationIngest(metadata.ingestMethod), 'API');
  const ref = conversationExternalRef(metadata, 'fallback');
  assert.match(ref, /^conversation:elevenlabs:[a-f0-9]{64}$/);
  assert.doesNotMatch(ref, /conv_secret_123/);
});

test('v2 conversation envelope retains provider metadata and stable turns', () => {
  const parsed = parseDatingTranscript('User: Hello\nAgent: Hi');
  const metadata = validateConversationMetadata({ provider: 'ELEVENLABS', ingestMethod: 'MANUAL_PASTE', agentName: 'Dorian' });
  const payload = buildConversationPayload({ text: parsed.text, speakers: parsed.speakers, turns: parsed.turns, metadata });
  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'CONVERSATION_TRANSCRIPT');
  assert.equal(payload.provider, 'ELEVENLABS');
  assert.equal(payload.turns[0].id, 'T001');
  assert.equal(payload.turns[1].speaker, 'Agent');
});

test('dating adapter writes generic conversation channels while reading legacy sources', () => {
  assert.match(importer, /CONVERSATION_TRANSCRIPT_CHANNEL/);
  assert.match(importer, /PERSON_CONVERSATION_SOURCE_CHANNEL/);
  assert.match(importer, /DATING_CONVERSATION_TRANSCRIPT/);
  assert.match(importer, /DATING_PERSON_REFLECTION/);
  assert.match(sourceService, /LEGACY_DATING_CONVERSATION_TRANSCRIPT_CHANNEL/);
  assert.match(sourceService, /LEGACY_DATING_PERSON_REFLECTION_CHANNEL/);
  assert.match(sourceService, /PERSON_CONVERSATION_SOURCE_CHANNEL/);
  assert.match(sourceService, /sourceTurnIds/);
});

test('living-understanding evidence uses persisted conversation turns when available', () => {
  assert.match(revisionService, /source\.conversationTurns\?\.length/);
  assert.match(revisionService, /persisted provider-independent turn IDs/);
  assert.match(revisionService, /target: turn\.speaker === source\.speaker/);
});

test('manual import UI captures ElevenLabs-ready metadata and goes directly to LU review', () => {
  assert.match(importUi, /External conversation ID/);
  assert.match(importUi, /ElevenLabs/);
  assert.match(importUi, /Agent name/);
  assert.match(importUi, /Review impact on Living Understanding/);
  assert.match(importUi, /Create initial Living Understanding/);
  assert.match(importUi, /Agent turns remain available as conversational context but are not direct evidence/);
  assert.match(importRoute, /getCurrentLivingUnderstanding/);
  assert.match(importRoute, /impact-review\?sourceInteractionId/);
  assert.match(importRoute, /understanding\/initial\?initial=1&sourceInteractionId/);
  assert.doesNotMatch(importer, /generateStructured|OPENAI_API_KEY/);
});

test('person-first import link carries the selected participant without creating a second ingestion path', () => {
  assert.match(personUi, /dating\/conversations\/import\?personId=/);
  assert.match(importUi, /defaultMapping/);
  assert.match(importUi, /\^\(user\|participant\|caller\|customer\|client\)\$/);
  assert.match(importUi, /\^\(agent\|assistant\|dorian\)\$/);
});

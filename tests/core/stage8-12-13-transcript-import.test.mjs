// Stage 8.12.13: exercise strict speaker separation and inspect custody/consent integration.
// These tests do not claim database or browser acceptance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { parseDatingTranscript, speakerExcerptChunks, validateSpeakerMapping } = await import('../../src/lib/server/datingTranscriptImportPolicy.ts');
const service = readFileSync(new URL('../../src/lib/server/datingTranscriptImport.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../../src/routes/dating/conversations/import/+page.server.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../../src/routes/dating/conversations/import/+page.svelte', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../src/lib/server/datingLivingUnderstanding.ts', import.meta.url), 'utf8');
test('preserves each speaker verbatim and never includes another speaker in the excerpt', () => {
  const parsed = parseDatingTranscript('Alex: I might want to date.\nJamie: I am not ready to date.\nAlex: I also want friends.');
  assert.deepEqual(parsed.speakers, ['Alex', 'Jamie']);
  assert.equal(parsed.turns.length, 3);
  assert.deepEqual(speakerExcerptChunks(parsed.turns, 'Alex'), ['Alex: I might want to date.\n\nAlex: I also want friends.']);
  assert.deepEqual(speakerExcerptChunks(parsed.turns, 'Jamie'), ['Jamie: I am not ready to date.']);
});
test('preserves continuation text, including another person mentioned inside a speaker turn', () => {
  const parsed = parseDatingTranscript('Alex: I think Jamie likes hiking.\nI am less sure about hiking myself.\nJamie: I prefer running.');
  assert.match(speakerExcerptChunks(parsed.turns, 'Alex')[0], /I think Jamie likes hiking/);
  assert.doesNotMatch(speakerExcerptChunks(parsed.turns, 'Alex')[0], /Jamie: I prefer/);
});
test('requires explicit labels and rejects overly large, empty and overlong turns', () => {
  assert.throws(() => parseDatingTranscript('I like people but there are no speaker labels.'), /speaker label/);
  assert.throws(() => parseDatingTranscript('Alex: ' + 'x'.repeat(60001)), /60,000/);
  const parsed = parseDatingTranscript('Alex: ' + 'x'.repeat(5000));
  assert.throws(() => speakerExcerptChunks(parsed.turns, 'Alex'), /4,800/);
});
test('requires intentional scoped mapping, no duplicates, at least one included person', () => {
  const speakers = ['Alex', 'Jamie'];
  const valid = new Set(['person-a', 'person-b']);
  assert.deepEqual(validateSpeakerMapping(speakers, { Alex: 'person-a', Jamie: 'SKIP' }, valid), new Set(['person-a']));
  assert.throws(() => validateSpeakerMapping(speakers, { Alex: 'person-a', Jamie: 'person-a' }, valid), /different person/);
  assert.throws(() => validateSpeakerMapping(speakers, { Alex: 'SKIP', Jamie: 'SKIP' }, valid), /at least one/);
  assert.throws(() => validateSpeakerMapping(speakers, { Alex: 'outside', Jamie: 'SKIP' }, valid), /Choose a person/);
});
test('full original is encrypted, excerpts separately encrypted and subject scoped', () => {
  assert.match(service, /ownerUserId: scope\.userId, domainKey: 'dating'/);
  assert.match(service, /prisma\.contact\.findMany/);
  assert.match(service, /contextSpaceId: scope\.contextSpaceId/);
  assert.match(service, /validateSpeakerMapping\(/);
  assert.match(service, /channel: CONVERSATION_TRANSCRIPT_CHANNEL/);
  assert.match(service, /channel: PERSON_CONVERSATION_SOURCE_CHANNEL/);
  assert.match(service, /encrypt\(JSON\.stringify\(/);
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(source, /CONVERSATION_EXCERPT/);
  assert.doesNotMatch(service, /console\.log\(/);
});
test('separate permission to retain a transcript and permission to invoke AI suggestions', () => {
  assert.match(route, /retainConsent/);
  assert.match(ui, /will not send this transcript to AI on import/);
  assert.match(ui, /AI processing permission/);
  assert.doesNotMatch(service, /generateStructured|suggestDatingKnowledge/);
});

// Stage 8.12.13.2: avoid the false third speaker from exported transcripts.
test('ignores a leading conversation heading but retains it in encrypted original text', () => {
  const parsed = parseDatingTranscript('Conversation Transcript:\n\nUser: Hello there.\nAgent: Welcome.');
  assert.deepEqual(parsed.speakers, ['User', 'Agent']);
  assert.equal(parsed.turns.length, 2);
  assert.match(parsed.text, /^Conversation Transcript:/);
});

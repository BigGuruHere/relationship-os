// IT: Stage 8.12.13.4 regression fixture uses invented dialogue, never user transcripts.
// These deterministic tests do not replace an authorised DB or browser acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDatingTranscript, speakerSource, conversationWindows, validateSpeakerMapping } from '../../src/lib/server/datingTranscriptImportPolicy.ts';
import { sourceEvidenceMatch, inspectKnowledgeSelection } from '../../src/lib/server/knowledgeSuggestionQuality.ts';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const importer = read('../../src/lib/server/datingTranscriptImport.ts');
const extraction = read('../../src/lib/server/datingKnowledgeExtraction.ts');
const sourceService = read('../../src/lib/server/datingLivingUnderstanding.ts');
const reviewUI = read('../../src/routes/dating/people/[id]/understanding/+page.svelte');
const importUI = read('../../src/routes/dating/conversations/import/+page.svelte');

const fixture = `Conversation Transcript:\nUser: I would like to make new friends.\nAgent: Would you enjoy hiking together?\nUser: I might enjoy hiking, but I prefer smaller groups.\nAgent: Should I search for a hiking group?\nUser: No, let's keep talking about my friendships.\nUser: I feel ready to make new friends.`;

test('one complete speaker source for one review, with excluded agent only in encrypted original context', () => {
  const parsed = parseDatingTranscript(fixture);
  const mapping = { User: 'owned-contact', Agent: 'SKIP' };
  assert.deepEqual([...validateSpeakerMapping(parsed.speakers, mapping, new Set(['owned-contact']))], ['owned-contact']);
  const personal = speakerSource(parsed.turns, 'User');
  assert.equal(personal.match(/User:/g)?.length, 4);
  assert.doesNotMatch(personal, /Agent:/);
  assert.match(personal, /prefer smaller groups/);
  assert.match(parsed.text, /Would you enjoy hiking together/);
  assert.match(importer, /importVersion: 3/);
  assert.match(importer, /speakerSource\(parsed\.turns, speaker\)/);
  assert.doesNotMatch(importer, /speakerExcerptChunks/);
});

test('long conversations use private internal windows with full preceding dialogue and no split review', () => {
  const turns = parseDatingTranscript('User: ' + 'I like chess and hiking. '.repeat(200) + '\nAgent: Why hiking?\nUser: I like nature and conversation.').turns;
  const windows = conversationWindows(turns, 'User', 6000);
  assert.equal(windows.length, 1);
  assert.match(windows[0].context, /Agent: Why hiking/);
  assert.doesNotMatch(windows[0].speakerSource, /Agent: Why hiking/);
  const long = parseDatingTranscript(Array.from({length: 12}, (_, n) => (n % 2 ? 'Agent: Tell me more about your plans. ' : 'User: My friends like to meet outside. ') + 'interesting '.repeat(120)).join('\n'));
  const parts = conversationWindows(long.turns, 'User', 2200);
  assert.ok(parts.length > 1);
  assert.equal(parts.map(part => part.speakerSource).filter(Boolean).length, parts.length);
  assert.equal(parts.map(part => part.speakerSource).join('\n\n'), speakerSource(long.turns, 'User'));
  assert.ok(parts.some(part => part.context.includes('Agent:')));
});

test('one very long turn is processed in internal windows without changing the full source', () => {
  const original = 'User: ' + 'I want friendships and community. '.repeat(450);
  const parsed = parseDatingTranscript(original);
  const chunks = conversationWindows(parsed.turns, 'User', 3000);
  assert.ok(chunks.length > 1);
  assert.equal(speakerSource(parsed.turns, 'User'), original.trim());
  assert.ok(chunks.every(part => part.context.startsWith('User: ')));
});

test('exact evidence is retrieved from target speaker, repairing only continuous STT word joins', () => {
  const source = "User: My friend can alsobring energy and someone who's conscious of health matters to me.";
  const recovered = sourceEvidenceMatch(source, 'My friend can also bring energy and someone who is conscious of health matters to me');
  assert.equal(recovered, null, 'do not change contractions while attempting word-join repair');
  const joined = sourceEvidenceMatch(source, "My friend can also bring energy and someone who's conscious of health matters to me");
  assert.ok(joined && source.includes(joined));
  assert.match(joined, /alsobring/);
  const report = inspectKnowledgeSelection([{ kind: 'PREFERENCE', statement: 'Values shared energy', evidenceQuote: "My friend can also bring energy and someone who's conscious of health matters to me" }], source, 32, true);
  assert.equal(report.selected.length, 1);
  assert.ok(source.includes(report.selected[0].evidenceQuote));
  assert.equal(sourceEvidenceMatch(source, 'An invented passage about another speaker never spoken by the target'), null);
  assert.equal(sourceEvidenceMatch('User: Hiking.\n\nUser: I enjoy chess.', 'Hiking... I enjoy chess.'), null, 'never splice two turns');
});

test('private parent lookup, consent and retained diagnostics remain explicit', () => {
  assert.match(sourceService, /CONVERSATION_TRANSCRIPT_CHANNEL/);
  assert.match(sourceService, /contextSpaceId: scope\.contextSpaceId/);
  assert.match(sourceService, /conversationContext = original\.text/);
  assert.match(extraction, /conversationWindows\(/);
  assert.match(extraction, /only the target speaker is evidence/);
  assert.match(extraction, /inspectKnowledgeSelection\(candidates, text/);
  assert.match(reviewUI, /Read original conversation with all speakers/);
  assert.match(reviewUI, /entire conversation, including excluded speakers as context/);
  assert.match(importUI, /separate processing permission/);
  assert.doesNotMatch(importer, /generateStructured|OPENAI_API_KEY/);
});

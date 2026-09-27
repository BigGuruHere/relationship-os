// PURPOSE: Stage 8.12.13.3 private diagnostics and explicit skip-speaker acceptance gates.
// These deterministic tests cannot establish live-AI accuracy, DB custody or browser behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectKnowledgeSelection, sourceEvidenceMatch } from '../../src/lib/server/knowledgeSuggestionQuality.ts';
import { parseDatingTranscript, speakerExcerptChunks, validateSpeakerMapping } from '../../src/lib/server/datingTranscriptImportPolicy.ts';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const extraction = read('../../src/lib/server/datingKnowledgeExtraction.ts');
const importer = read('../../src/lib/server/datingTranscriptImport.ts');
const importUI = read('../../src/routes/dating/conversations/import/+page.svelte');
const reviewUI = read('../../src/routes/dating/people/[id]/understanding/+page.svelte');
const reviewServer = read('../../src/routes/dating/people/[id]/understanding/+page.server.ts');

// Invented fixture intentionally resembles transcription punctuation and speaker labels.
const source = `User: I'd like to have a family again, probably.\n\nUser: I want a partner who's conscious of health.`;
const proposal = (statement, evidenceQuote, kind = 'WANT') => ({ kind, statement, evidenceQuote });

test('quoted evidence may differ in punctuation but recovers literal original source passage', () => {
  assert.equal(sourceEvidenceMatch(source, 'I’d like to have a family again probably'), "I'd like to have a family again, probably");
  assert.equal(sourceEvidenceMatch(source, "I want a partner who's conscious of health"), "I want a partner who's conscious of health");
  assert.equal(sourceEvidenceMatch(source, 'A family that the speaker never discussed'), null);
  assert.equal(sourceEvidenceMatch(source, 'imaginary'), null);
});

test('recovered evidence passes the review gate as literal source, not a fabricated quote', () => {
  const result = inspectKnowledgeSelection([proposal('Wants a family again', 'I’d like to have a family again probably')], source, 32);
  assert.equal(result.selected.length, 1);
  assert.ok(source.includes(result.selected[0].evidenceQuote));
  assert.match(reviewServer, /sourceEvidenceMatch\(source\.text, quote\)/);
});

test('detailed rejected content is absent by default and present only on explicit inspection', () => {
  const items = [proposal('Imaginary preference', 'Never stated anywhere'), proposal('Wants a family', "I'd like to have a family again"), proposal('Wants a family', "I'd like to have a family again")];
  const defaultReview = inspectKnowledgeSelection(items, source, 32);
  assert.deepEqual(defaultReview.rejected, []);
  assert.ok(!JSON.stringify(defaultReview.report).includes('Imaginary preference'));
  const diagnostic = inspectKnowledgeSelection(items, source, 32, true);
  assert.deepEqual(diagnostic.rejected.map(item => item.reason), ['invalidSourcePassage', 'exactDuplicate']);
  assert.equal(diagnostic.rejected[0].statement, 'Imaginary preference');
  assert.equal(diagnostic.rejected[0].evidenceQuote, 'Never stated anywhere');
  assert.equal(diagnostic.rejected[1].overlapsWith, 'Wants a family');
  assert.match(extraction, /process\.env\.NODE_ENV !== 'production' && process\.env\.DATING_KNOWLEDGE_DIAGNOSTICS === 'YES'/);
  assert.match(reviewUI, /rejectedCandidates/);
  assert.doesNotMatch(extraction, /console\.log\(.*rejectedCandidates/);
});

test('SKIP agent remains only in original, not in the selected speaker excerpts', () => {
  const parsed = parseDatingTranscript('Conversation Transcript:\nUser: I want a family.\nAgent: Tell me more.\nUser: I want partnership.');
  const mapping = { User: 'person-u', Agent: 'SKIP' };
  assert.deepEqual([...validateSpeakerMapping(parsed.speakers, mapping, new Set(['person-u']))], ['person-u']);
  const extractedSpeakers = parsed.speakers.filter(speaker => mapping[speaker] !== 'SKIP');
  assert.deepEqual(extractedSpeakers, ['User']);
  const excerpts = extractedSpeakers.flatMap(speaker => speakerExcerptChunks(parsed.turns, speaker));
  assert.equal(excerpts.length, 1);
  assert.ok(!excerpts[0].includes('Agent:'));
  assert.ok(parsed.text.includes('Agent: Tell me more.'));
  assert.match(importer, /parsed\.speakers\.filter\(speaker => mapping\[speaker\] !== 'SKIP'\)/);
  assert.match(importer, /excludedSpeakers/);
  assert.match(importUI, /form\.imported\.excludedSpeakers/);
  assert.match(importUI, /excerpt\.speaker/);
});

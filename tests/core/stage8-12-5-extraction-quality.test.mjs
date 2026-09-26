// Pure behaviour tests exercise the actual extraction selection helper, not only source text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectKnowledgeSuggestions } from '../../src/lib/server/knowledgeSuggestionQuality.ts';

const source = `Last Saturday I went to a social event in Melbourne. I want to meet more people.
I have been lonely on weekends. I enjoy walking on the beach. I like tennis and live music.
I work on my business and sometimes spend too much time alone. I value my independence.
I am not sure whether I am ready for a serious relationship, but would like to meet someone.
Over the next three months, I want to make two new friends and join a walking group.`;
const item = (kind, statement, evidenceQuote) => ({ kind, statement, evidenceQuote });

test('supports multiple kinds and preserves exact passage and original uncertainty', () => {
  const found = selectKnowledgeSuggestions([
    item('WANT', 'Wants to meet more people', 'I want to meet more people.'),
    item('PREFERENCE', 'Enjoys walking on the beach', 'I enjoy walking on the beach.'),
    item('CONSTRAINT', 'Is unsure whether ready for a serious relationship', 'I am not sure whether I am ready for a serious relationship'),
    item('FACT', 'Works on own business', 'I work on my business'),
    item('OBJECTIVE', 'Wants two new friends within three months', 'Over the next three months, I want to make two new friends')
  ], source);
  assert.equal(found.length, 5);
  assert.deepEqual(new Set(found.map(x => x.kind)), new Set(['WANT','PREFERENCE','CONSTRAINT','FACT','OBJECTIVE']));
  assert.match(found.find(x => x.kind === 'CONSTRAINT').statement, /unsure/);
});

test('does not allow ungrounded, invented kind or duplicate proposal', () => {
  const result = selectKnowledgeSuggestions([
    item('WANT', 'Wants friends', 'I want to meet more people.'),
    item('WANT', '  WANTS FRIENDS ', 'I want to meet more people.'),
    item('DIAGNOSIS', 'Has anxiety', 'I want to meet more people.'),
    item('FACT', 'Lives in Tasmania', 'I own a mountain in Tasmania'),
    item('PREFERENCE', 'Enjoys beach walks', 'I enjoy walking on the beach.')
  ], source);
  assert.equal(result.length, 2);
});

test('diverse selection considers items at end of model response before 12 cap', () => {
  const candidates = Array.from({length: 15}, (_, i) => item('WANT', `Wants friends item ${i}`, 'I want to meet more people.'));
  candidates.push(item('CONSTRAINT', 'Uncertain about serious relationships', 'I am not sure whether I am ready for a serious relationship'));
  candidates.push(item('FACT', 'Working on business', 'I work on my business'));
  const found = selectKnowledgeSuggestions(candidates, source, 12);
  assert.equal(found.length, 3); // repeated synthetic phrasings now collapse into one meaningful want
  assert.ok(found.some(x => x.kind === 'CONSTRAINT'));
  assert.ok(found.some(x => x.kind === 'FACT'));
});

test('related but distinct wants and constraints survive independently', () => {
  const result = selectKnowledgeSuggestions([
    item('WANT', 'Would like to meet someone', 'would like to meet someone.'),
    item('CONSTRAINT', 'Not sure about serious relationship readiness', 'not sure whether I am ready for a serious relationship'),
  ], source);
  assert.equal(result.length, 2);
});

test('extractor has a bounded second pass and no automatic claims or disclosure', () => {
  const extractor = readFileSync('src/lib/server/datingKnowledgeExtraction.ts', 'utf8');
  assert.match(extractor, /text\.length >= 600/);
  assert.match(extractor, /dating_private_person_knowledge_coverage_review/);
  assert.match(extractor, /requireSourceReflection\(scope, sourceInteractionId\)/);
  assert.doesNotMatch(extractor, /knowledgeClaim\.create/);
  assert.match(extractor, /inspectKnowledgeSelection\(candidates, text, 32\)/);
});

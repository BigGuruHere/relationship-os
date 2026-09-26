// Stage 8.12.10: fictional, privacy-safe regression for the deterministic selection gates.
// These tests make no claim about variable live-model extraction or semantic entailment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectKnowledgeSelection } from '../../src/lib/server/knowledgeSuggestionQuality.ts';

// This is an invented source, not a copied private reflection or any user's personal history.
const source = `I have been working alone on a small business and I miss having colleagues nearby.
I feel lonely some evenings, and I would like to develop more male friendships.
I like tennis and live music, but big networking events exhaust me.
I prefer smaller gatherings where introductions happen naturally.
I hope to grow my business, though working from home leaves me socially isolated.
I would be open to meeting a romantic partner, but I'm not sure whether I'm ready for a serious relationship.
I want closeness while retaining my own independence.
Last Saturday I attended a concert, and yesterday I went to a cafe.`;
const entry = (kind, statement, evidenceQuote) => ({ kind, statement, evidenceQuote });
const proposals = [
  entry('FACT', 'Feels lonely on some evenings', 'I feel lonely some evenings'),
  entry('WANT', 'Wants to develop more male friendships', 'I would like to develop more male friendships'),
  entry('PREFERENCE', 'Likes tennis', 'I like tennis'),
  entry('PREFERENCE', 'Likes live music', 'live music'),
  entry('CONSTRAINT', 'Large networking events exhaust the speaker', 'big networking events exhaust me'),
  entry('PREFERENCE', 'Prefers smaller gatherings with natural introductions', 'I prefer smaller gatherings where introductions happen naturally'),
  entry('OBJECTIVE', 'Hopes to grow a small business', 'I hope to grow my business'),
  entry('CONSTRAINT', 'Working from home currently leaves the speaker socially isolated', 'working from home leaves me socially isolated'),
  entry('WANT', 'Open to meeting a romantic partner', 'I would be open to meeting a romantic partner'),
  entry('WANT', 'Open to meeting a romantic partner but not sure about commitment', "I would be open to meeting a romantic partner, but I'm not sure whether I'm ready for a serious relationship"),
  entry('CONSTRAINT', 'Not sure whether ready for a serious relationship', "I'm not sure whether I'm ready for a serious relationship"),
  entry('WANT', 'Wants closeness while retaining independence', 'I want closeness while retaining my own independence'),
  entry('FACT', 'Last Saturday attended a concert', 'Last Saturday I attended a concert'),
  entry('FACT', 'Yesterday went to a cafe', 'yesterday I went to a cafe')
];

test('fictional complete coverage remains individually reviewable over multiple pages', () => {
  const { selected, report } = inspectKnowledgeSelection(proposals, source, 32);
  assert.equal(selected.length, proposals.length);
  assert.equal(report.eligibleCount, proposals.length);
  assert.equal(report.beyondLimitCount, 0);
  for (const suggestion of proposals) {
    assert.ok(selected.some(item => item.statement === suggestion.statement), suggestion.statement);
  }
  const firstPage = inspectKnowledgeSelection(proposals, source, 12);
  assert.equal(firstPage.report.displayedCount, 12);
  assert.equal(firstPage.report.rejectionReasons.reviewLimitDeferred, 2);
  assert.ok(firstPage.selected.filter(item => /last saturday|yesterday/i.test(item.statement)).length <= 1);
});

test('similar wording with added uncertainty or negation is not silently collapsed', () => {
  const candidates = [
    entry('WANT', 'Open to meeting a romantic partner', 'I would be open to meeting a romantic partner'),
    entry('WANT', 'Open to meeting a romantic partner but not sure about commitment', "I would be open to meeting a romantic partner, but I'm not sure whether I'm ready for a serious relationship"),
    entry('WANT', 'Not open to meeting a romantic partner', 'I would be open to meeting a romantic partner')
  ];
  // The final candidate has verbatim evidence but contradicts it. This gate must NOT
  // pretend to detect such semantic fabrication; that requires human/model evaluation.
  const { selected } = inspectKnowledgeSelection(candidates, source, 32);
  assert.equal(selected.length, 3);
});

test('rejection reasons expose counts, not source quotations or candidate text', () => {
  const candidates = [
    null,
    entry('INVALID', 'Something', 'I like tennis'),
    entry('WANT', '', 'I like tennis'),
    entry('WANT', 'Wants tennis', 'A quote never present'),
    entry('WANT', 'Wants male friendships', 'I would like to develop more male friendships'),
    entry('WANT', 'Wants male friendships', 'I would like to develop more male friendships'),
    entry('WANT', 'Wants additional male friendships', 'I would like to develop more male friendships')
  ];
  const report = inspectKnowledgeSelection(candidates, source, 1).report;
  assert.deepEqual(report.rejectionReasons, {
    malformedItem: 1, invalidKind: 1, invalidStatement: 1,
    invalidSourcePassage: 1, exactDuplicate: 1, nearDuplicate: 1, reviewLimitDeferred: 0
  });
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes('friendships'));
  assert.ok(!serialized.includes('tennis'));
  assert.ok(!serialized.includes('A quote never present'));
});

test('new accuracy fixture is permanently included without editing the dependency lockfile', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts.test, /tests\/core\/\*\.test\.mjs/);
  assert.match(pkg.scripts['check:stage8.12.10'], /stage8-12-10-extraction-accuracy/);
});

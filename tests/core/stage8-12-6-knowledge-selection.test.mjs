import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectKnowledgeSuggestions } from '../../src/lib/server/knowledgeSuggestionQuality.ts';

const source = `Last Saturday I went to an event in Melbourne. I'd like to meet more people and expand my social circle. I want a group of friends to spend time with. I sometimes work alone on my business. I enjoy tennis and live music. I'm considering joining a walking group. I would welcome a relationship, but I'm not sure whether I'm ready for a serious relationship. I value closeness while maintaining my individuality.`;
const item = (kind, statement, evidenceQuote) => ({kind,statement,evidenceQuote});
test('retains an explicit uncertainty beside a related romantic wish', () => {
  const found = selectKnowledgeSuggestions([
    item('WANT', 'Would welcome a romantic relationship', 'I would welcome a relationship'),
    item('CONSTRAINT', 'Not sure whether ready for a serious relationship', "I'm not sure whether I'm ready for a serious relationship"),
  ], source);
  assert.equal(found.length, 2);
  assert.ok(found.some(x => x.kind === 'CONSTRAINT'));
});
test('near-identical wishes are consolidated while distinct qualifications remain', () => {
  const found = selectKnowledgeSuggestions([
    item('WANT', 'Wants to meet more people and expand social circle', "I'd like to meet more people and expand my social circle"),
    item('WANT', 'Wants to meet more people and expand their social circle', "I'd like to meet more people and expand my social circle"),
    item('CONSTRAINT', 'Unsure about readiness for a serious relationship', "I'm not sure whether I'm ready for a serious relationship")
  ], source);
  assert.equal(found.length, 2);
});
test('a one-off event is not ranked ahead of otherwise equally grounded current knowledge', () => {
  const found = selectKnowledgeSuggestions([
    item('FACT', 'Last Saturday attended an event in Melbourne', 'Last Saturday I went to an event in Melbourne'),
    item('FACT', 'Sometimes works alone on a business', 'I sometimes work alone on my business')
  ], source);
  assert.equal(found[0].statement, 'Sometimes works alone on a business');
});
test('a later uncertainty survives an initial limit even after many early wants', () => {
  const wants = Array.from({length: 17}, (_, i) => item('WANT', `Wants social circle idea ${i}`, "I'd like to meet more people and expand my social circle"));
  const found = selectKnowledgeSuggestions([...wants, item('CONSTRAINT','Uncertain about being ready for a serious relationship',"I'm not sure whether I'm ready for a serious relationship")], source, 12);
  assert.ok(found.some(x => x.kind === 'CONSTRAINT'));
});
test('larger review window preserves valid extra suggestions with literal evidence', () => {
  const candidates = Array.from({length: 15}, (_, i) => item('WANT', `Distinct goal number ${i} about social contacts`, "I'd like to meet more people and expand my social circle"));
  const found = selectKnowledgeSuggestions(candidates, source, 32);
  assert.ok(found.length >= 1);
  const ui = readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');
  const route = readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts', 'utf8');
  assert.match(ui, /SUGGESTIONS_PER_PAGE = 12/);
  assert.match(ui, /Next suggestions/);
  assert.match(route, /count > 32/);
});
test('later pages retain more than twelve genuinely distinct supported items', () => {
  const activities = ['tennis', 'walking', 'cooking', 'painting', 'hiking', 'cycling', 'running', 'reading', 'dancing', 'music', 'swimming', 'gardening', 'writing', 'photography', 'yoga'];
  const longSource = activities.map(a => `I enjoy ${a} with friends.`).join(' ');
  const proposals = activities.map(a => item('PREFERENCE', `Enjoys ${a} with friends`, `I enjoy ${a} with friends.`));
  const found = selectKnowledgeSuggestions(proposals, longSource, 32);
  assert.equal(found.length, 15, 'Additional distinct suggestions must remain available after the first review page.');
});
test('all stage tests are included in npm test and DB tests require explicit opt-in', () => {
  const p = JSON.parse(readFileSync('package.json','utf8'));
  assert.match(p.scripts.test, /\.test\.mjs/);
  assert.match(p.scripts.test, /\.test\.ts/);
  assert.match(p.scripts['test:db'], /run-stage-db-tests/);
  assert.match(readFileSync('scripts/run-stage-db-tests.mjs','utf8'), /ALLOW_DATING_DEV_DB_TEST/);
});

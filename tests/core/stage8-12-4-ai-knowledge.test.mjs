// Stage 8.12.4 regression guards. Integration and live provider checks remain separate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const extractor = readFileSync('src/lib/server/datingKnowledgeExtraction.ts', 'utf8');
const route = readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts', 'utf8');
const ui = readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');

test('AI extraction is explicitly opt-in and source is custody validated', () => {
  assert.match(route, /allowModelProcessing.*'YES'/);
  assert.match(extractor, /requireSourceReflection\(scope, sourceInteractionId\)/);
  assert.match(route, /requireSourceReflection\(scope, sourceId\)/);
});
test('AI suggestions are not directly promoted to active knowledge', () => {
  assert.match(extractor, /normalizeKnowledgeSuggestions/);
  assert.doesNotMatch(extractor, /knowledgeClaim\.create/);
  assert.match(ui, /Save reviewed suggestions/);
  assert.match(route, /createDatingUnderstanding\(scope/);
});
test('every suggestion retains literal reflection evidence and known category', () => {
  assert.match(extractor, /normalise\(source\)\.includes\(normalise\(quote\)\)/);
  assert.match(route, /normalize\(source\.text\)\.includes\(normalize\(quote\)\)/);
  assert.match(route, /\['FACT','WANT','OFFER','PREFERENCE','CONSTRAINT','OBJECTIVE','OTHER'\]/);
});
test('operator attribution and sensitive audit remain enforced', () => {
  assert.match(extractor, /auditDataClass: 'sensitive'/);
  assert.match(ui, /Confirm as operator/);
  assert.doesNotMatch(route, /actor: 'PARTICIPANT'/);
});
test('multiple suggestions can be individually edited and decided before one save', () => {
  assert.match(ui, /name={`statement_\$\{i\}`}/);
  assert.match(ui, /name={`decision_\$\{i\}`}/);
  assert.match(ui, /value="SKIP"/);
  assert.match(route, /existingKeys\.has\(fingerprint\)/);
});
test('original personal reflection and Catalina lockfile are not modified by this stage', () => {
  assert.match(extractor, /generateStructured/);
  assert.doesNotMatch(extractor, /interaction\.update|interaction\.delete/);
});

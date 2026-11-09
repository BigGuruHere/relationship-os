// Stage 8.15.3 source-contract regression checks; integration testing still required.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('shared correction service retains evidence and marks superseded knowledge', () => {
  const source = read('src/lib/server/core/noteRevisions.ts');
  assert.match(source, /createCoreInteraction\(context/);
  assert.match(source, /correction-of:/);
  assert.match(source, /knowledgeEvidence\.updateMany/);
  assert.match(source, /status: 'SUPERSEDED'/);
});

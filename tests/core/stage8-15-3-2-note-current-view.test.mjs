// IT: Stage 8.15.3.2 checks the visible current-note projection and provenance safeguards.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('correction retires source-specific evidence without rewriting LU history', () => {
  const src = read('src/lib/server/core/noteRevisions.ts');
  assert.match(src, /knowledgeEvidence\.updateMany/);
  assert.match(src, /knowledgeClaim\.updateMany/);
  assert.doesNotMatch(src, /livingUnderstandingRevision\.update/);
});

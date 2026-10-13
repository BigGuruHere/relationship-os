import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('conversation history directly overlays explicit dismissal disposition', () => {
  const server = fs.readFileSync('src/routes/general/people/[id]/+page.server.ts', 'utf8');
  assert.match(server, /listLivingUnderstandingReviewDispositions/);
  assert.match(server, /dispositionBySourceId/);
  assert.match(server, /disposition\?\.status === 'DISMISSED'/);
  assert.match(server, /state: 'DISMISSED'/);
});

test('conversation history is explicitly non-cacheable and labels storage as imported', () => {
  const server = fs.readFileSync('src/routes/general/people/[id]/+page.server.ts', 'utf8');
  const page = fs.readFileSync('src/routes/general/people/[id]/+page.svelte', 'utf8');
  assert.match(server, /cache-control': 'no-store'/);
  assert.match(page, />Imported<\/span>/);
  assert.match(page, /Dismissed from Living Understanding review/);
});

test('disposition helper batches source ids inside the same participant scope', () => {
  const core = fs.readFileSync('src/lib/server/core/livingUnderstandingReviewDisposition.ts', 'utf8');
  assert.match(core, /listLivingUnderstandingReviewDispositions/);
  assert.match(core, /sourceInteractionId: \{ in: ids \}/);
  assert.match(core, /where: \{ \.\.\.scope, sourceInteractionId/);
});

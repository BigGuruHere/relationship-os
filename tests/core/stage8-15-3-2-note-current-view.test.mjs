// IT: Stage 8.15.3.2 checks the visible current-note projection and provenance safeguards.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('contact history groups revisions before limiting results', () => {
  const src = read('src/routes/contacts/[id]/+page.server.ts');
  assert.match(src, /groupCurrentNotes\(interactionsRaw\)/);
  assert.match(src, /contextSpaceId: createWorkspaceCoreAccess/);
  assert.ok(src.indexOf('groupCurrentNotes(interactionsRaw)') < src.indexOf('.slice(0, 50)'));
});
test('old note URLs redirect to newest scoped revision with optional history', () => {
  const src = read('src/routes/contacts/[id]/interactions/[iid]/+page.server.ts');
  assert.match(src, /loadNoteRevisionState/);
  assert.match(src, /revision\.current\.id !== params\.iid/);
  assert.match(src, /revisionHistory:/);
});
test('correction retires source-specific evidence without rewriting LU history', () => {
  const src = read('src/lib/server/core/noteRevisions.ts');
  assert.match(src, /knowledgeEvidence\.updateMany/);
  assert.match(src, /knowledgeClaim\.updateMany/);
  assert.doesNotMatch(src, /livingUnderstandingRevision\.update/);
});

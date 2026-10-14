// Stage 8.15.3 source-contract regression checks; integration testing still required.
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('contact note creation resolves subject through ContextSpace-scoped Core access', () => {
  const source = read('src/routes/contacts/[id]/interactions/new/+page.server.ts');
  assert.match(source, /findCoreContact\(context, params\.id/);
  assert.match(source, /contextSpaceId: context\.contextSpaceId/);
});
test('both editing entrypoints append a source instead of mutating raw text', () => {
  for (const path of ['src/routes/contacts/[id]/interactions/[iid]/edit/+page.server.ts', 'src/routes/contacts/[id]/interactions/[iid]/+page.server.ts']) {
    const source = read(path);
    assert.match(source, /saveCurrentNoteCorrection\(context/);
    assert.doesNotMatch(source, /rawTextEnc\s*:/);
  }
});
test('shared correction service retains evidence and marks superseded knowledge', () => {
  const source = read('src/lib/server/core/noteRevisions.ts');
  assert.match(source, /createCoreInteraction\(context/);
  assert.match(source, /correction-of:/);
  assert.match(source, /knowledgeEvidence\.updateMany/);
  assert.match(source, /status: 'SUPERSEDED'/);
});
test('note delete requires POST and protects cited source records', () => {
  const source = read('src/routes/contacts/[id]/interactions/[iid]/delete/+server.ts');
  assert.match(source, /export const POST/);
  assert.doesNotMatch(source, /export const GET/);
  for (const delegate of ['knowledgeEvidence','livingUnderstandingRevisionSource','livingUnderstandingTopicVersionSource','livingUnderstandingDraft','livingUnderstandingSourceReviewDisposition','want','offer','objective','introduction','outcome']) {
    assert.ok(source.includes(`prisma.${delegate}.count`), `Missing ${delegate} guard`);
  }
});

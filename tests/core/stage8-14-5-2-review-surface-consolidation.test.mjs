import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('person conversation page is archival and routes decisions to the review inbox', () => {
  const page = fs.readFileSync('src/routes/general/people/[id]/+page.svelte', 'utf8');
  assert.match(page, /<h2>Conversation history<\/h2>/);
  assert.match(page, /Living Understanding decisions are handled in the General operator review inbox/);
  assert.match(page, /Imported/);
  assert.match(page, /Pending Living Understanding review/);
  assert.match(page, /Dismissed from Living Understanding review/);
  assert.match(page, /Included in authoritative Living Understanding/);
  assert.doesNotMatch(page, /Review impact on Living Understanding/);
  assert.doesNotMatch(page, /action="\?\/dismissReview"/);
  assert.doesNotMatch(page, /action="\?\/restoreReview"/);
});

test('review inbox remains the operational decision surface with confirmation before dismiss', () => {
  const page = fs.readFileSync('src/routes/general/admin/reviews/+page.svelte', 'utf8');
  assert.match(page, /action="\?\/dismiss"/);
  assert.match(page, /window\.confirm\('Dismiss this conversation from Living Understanding review\?/);
  assert.match(page, /action="\?\/restore"/);
  assert.match(page, />Review<\/a>/);
});

test('participant route keeps status reads but removes duplicate dismiss and restore actions', () => {
  const server = fs.readFileSync('src/routes/general/people/[id]/+page.server.ts', 'utf8');
  assert.match(server, /describeLivingUnderstandingReviewHandoff/);
  assert.doesNotMatch(server, /dismissLivingUnderstandingReview/);
  assert.doesNotMatch(server, /restoreLivingUnderstandingReview/);
  assert.doesNotMatch(server, /dismissReview:/);
  assert.doesNotMatch(server, /restoreReview:/);
  assert.match(server, /updatePhone:/);
});

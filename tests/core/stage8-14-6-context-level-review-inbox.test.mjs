import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');

test('General operator review inbox is a context-level multi-person route', () => {
  const server = read('src/routes/general/admin/reviews/+page.server.ts');
  const page = read('src/routes/general/admin/reviews/+page.svelte');
  assert.match(server, /listLivingUnderstandingReviewInbox\(scope, 'general'\)/);
  assert.match(page, /One context-level queue for Living Understanding decisions across all people/);
  assert.match(page, /participantName/);
  assert.match(page, /action="\?\/dismiss"/);
  assert.match(page, /confirmDismiss/);
});

test('legacy General review route redirects to the operator inbox', () => {
  const legacy = read('src/routes/general/reviews/+page.server.ts');
  assert.match(legacy, /redirect\(308, '\/general\/admin\/reviews'\)/);
  assert.equal(fs.existsSync('src/routes/general/reviews/+page.svelte'), false);
});

test('person history stays archival while General navigation points to the context inbox', () => {
  const person = read('src/routes/general/people/[id]/+page.svelte');
  const people = read('src/routes/general/people/+page.svelte');
  const home = read('src/routes/general/+page.svelte');
  assert.doesNotMatch(person, /href="\/general\/admin\/reviews"/);
  assert.match(person, /General operator review inbox/);
  assert.match(people, /href="\/general\/admin\/reviews"/);
  assert.match(home, /href="\/general\/admin\/reviews"/);
});

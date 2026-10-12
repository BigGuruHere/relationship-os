import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('General participant page places review const directly under each block', () => {
  const source = fs.readFileSync('src/routes/general/people/[id]/+page.svelte', 'utf8');
  assert.match(
    source,
    /\{#each data\.sources as source\}\s*\{@const review = data\.reviewBySourceId\?\.\[source\.id\]\}\s*<article class="entry">/
  );
});

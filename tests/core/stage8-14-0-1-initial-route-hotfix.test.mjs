// PURPOSE: Regression coverage for the production initial Living Understanding route.
// This test is intentionally source-level because the route relies on SvelteKit's generated router.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');

test('initial Living Understanding uses a dedicated production route', async () => {
  const page = await read('src/routes/dating/people/[id]/understanding/+page.svelte');
  assert.match(page, /\/understanding\/initial\?initial=1&sourceInteractionId=/);
  assert.doesNotMatch(page, /\/understanding\/revision-experiment\?initial=1&sourceInteractionId=/);
});

test('initial route reuses the reviewed workflow behind a production wrapper', async () => {
  const server = await read('src/routes/dating/people/[id]/understanding/initial/+page.server.ts');
  const page = await read('src/routes/dating/people/[id]/understanding/initial/+page.svelte');
  assert.match(server, /load as sharedLoad, actions as sharedActions/);
  assert.match(server, /initial route load failed/);
  assert.match(server, /export const actions = sharedActions as (?:unknown as )?Actions/);
  assert.match(page, /Create initial Living Understanding/);
  assert.doesNotMatch(page, /revision-experiment\/\+page\.svelte/);
});

test('shared workflow still recognises initial=1 before the experiment flag guard', async () => {
  const server = await read('src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts');
  assert.match(server, /url\.searchParams\.get\('initial'\) === '1'/);
  assert.match(server, /authorisedScope\(locals, params\.id, initialCreationMode\)/);
  assert.match(server, /if \(!allowInitialCreation && !revisionExperimentEnabled\(\)\)/);
});

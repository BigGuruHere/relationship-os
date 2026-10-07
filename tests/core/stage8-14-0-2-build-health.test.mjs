// PURPOSE: Guard the Stage 8.14.0.2 build-health fixes that restore a useful svelte-check baseline.
// This is intentionally source-level so it can run without a browser or database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');

test('initial Living Understanding page owns its SvelteKit form state directly', async () => {
  const page = await read('src/routes/dating/people/[id]/understanding/initial/+page.svelte');
  assert.match(page, /export let form: any;/);
  assert.match(page, /Create initial Living Understanding/);
  assert.doesNotMatch(page, /InitialLivingUnderstandingWorkflow/);
});

test('TypeScript check accepts explicit .ts imports used by Node strip-types tests', async () => {
  const tsconfig = JSON.parse((await read('tsconfig.json')).replace(/\n\s*\/\/[^\n]*/g, '').replace(/\n\s*\/\/[^\n]*/g, ''));
  assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true);
});

test('public profile pages explicitly type dynamic page/form payloads', async () => {
  const settings = await read('src/routes/settings/profile/+page.svelte');
  const publicProfile = await read('src/routes/u/[slug]/+page.svelte');
  const publicLead = await read('src/routes/u/[slug]/lead/+page.svelte');
  assert.match(settings, /const p: any = data\?\.profile \|\| \{\};/);
  assert.match(publicProfile, /const prof: any = data\?\.profile \|\| \{\};/);
  assert.match(publicLead, /const v: any = form\?\.values \|\| \{\};/);
});

test('interaction recorder no longer treats beforeNavigate as unsubscribe and uses fetch BodyInit', async () => {
  const page = await read('src/routes/contacts/[id]/interactions/new/+page.svelte');
  assert.doesNotMatch(page, /const unreg = beforeNavigate/);
  assert.doesNotMatch(page, /unreg\?\.\(\)/);
  assert.match(page, /body: bytes\.buffer\.slice\([\s\S]*?\) as ArrayBuffer/);
});

test('public profile server narrows visitor id before Prisma and lead token call matches helper contract', async () => {
  const publicServer = await read('src/routes/u/[slug]/+page.server.ts');
  const leadServer = await read('src/routes/u/[slug]/lead/+page.server.ts');
  assert.match(publicServer, /if \(visitorUserId && visitorUserId !== ownerId\)/);
  assert.doesNotMatch(leadServer, /createInviteToken\([\s\S]*?meta:/);
});

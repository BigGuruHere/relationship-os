import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');

test('initial production route is self-rendering and logs unexpected load failures', async () => {
  const server = await read('src/routes/dating/people/[id]/understanding/initial/+page.server.ts');
  const page = await read('src/routes/dating/people/[id]/understanding/initial/+page.svelte');
  assert.match(server, /load as sharedLoad, actions as sharedActions/);
  assert.match(server, /console\.error\('\[living-understanding\] initial route load failed'/);
  assert.match(server, /Initial Living Understanding load failed:/);
  assert.match(page, /export let data: any;/);
  assert.match(page, /export let form: any;/);
  assert.doesNotMatch(page, /revision-experiment\/\+page\.svelte/);
});

test('reported compiler error classes are corrected without schema migration', async () => {
  const crypto = await read('src/lib/crypto.ts');
  const email = await read('src/lib/server/userEmail.ts');
  const throttle = await read('src/lib/server/loginThrottle.ts');
  const magic = await read('src/lib/server/magic.ts');
  const tags = await read('src/routes/api/tags/+server.ts');
  assert.match(crypto, /Buffer\.from\(crypto\.hkdfSync/);
  assert.match(email, /function toEmailIdx\(inputEmail: string\): Buffer/);
  assert.match(throttle, /type LoginBucket = 'ip' \| 'account'/);
  assert.match(magic, /ttlMinutes: 15/);
  assert.match(tags, /Prisma\.TagWhereInput/);
});

test('root Stage markdown files are archived under docs stage-history', async () => {
  const rootEntries = await readdir(new URL('../../', import.meta.url));
  assert.equal(rootEntries.filter((name) => /^STAGE.*\.md$/i.test(name)).length, 0);
  const archived = await readdir(new URL('../../docs/stage-history/', import.meta.url));
  assert.ok(archived.length >= 100);
  assert.ok(archived.includes('STAGE8_0_RETIREMENT_REGISTER.md'));
});

test('known references to moved stage documentation use the archive folder', async () => {
  const retirementTest = await read('tests/core/stage8-5-2-agent-access-hardening.test.ts');
  const updateScript = await read('scripts/stage8-10-5-controlled-update.mjs');
  assert.match(retirementTest, /docs\/stage-history\/STAGE8_0_RETIREMENT_REGISTER\.md/);
  assert.match(updateScript, /docs\/stage-history\/STAGE8_10_5_CONTROLLED_SECURITY_UPDATE\.md/);
});

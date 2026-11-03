// Owner-only legacy Contact organisation safety checks.
// These source-level regressions do not replace database-backed owner/custody tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const organiser = read('src/routes/people/organise/+page.server.ts');
const directory = read('src/routes/people/+page.server.ts');
const helper = read('src/lib/server/core/ownerPeopleOrganiser.ts');
const screen = read('src/routes/people/organise/+page.svelte');

test('owner-only organiser guards both its page load and its mutation', () => {
  assert.match(organiser, /locals\.user\.role !== 'owner'/);
  assert.match(organiser, /const userId = requireOwner\(locals\);/);
  assert.match(organiser, /const userId = requireOwner\(locals\);[\s\S]*?const form = await request\.formData\(\)/);
  assert.match(screen, /owner-only/i);
});

test('My People never loads Business records for non-owner users', () => {
  assert.match(directory, /const isOwner = locals\.user\.role === 'owner'/);
  assert.match(directory, /const ownerBusinessPeople = isOwner[\s\S]*?listOwnerBusinessContacts\(locals\.user\.id, true\)/);
  assert.match(directory, /: \[\];/);
});

test('Business contact classification is scoped to the owner and original ContextSpace', () => {
  assert.match(helper, /ownerUserId: userId, domainKey: 'business', kind: 'WORKSPACE'/);
  assert.match(helper, /runWithWorkspaceCustody\(\{ userId, contextSpaceId: space\.id \}/);
  assert.match(helper, /where: \{ id: contactId, userId, contextSpaceId: space\.id \}/);
  assert.match(helper, /OWNER_PERSONAL_TAG_SLUG/);
  assert.match(helper, /prisma\.contactTag\.createMany/);
  assert.match(helper, /prisma\.contactTag\.deleteMany/);
  // SECURITY: No Contact movement, copying, or mutation occurs in the classification helper.
  assert.doesNotMatch(helper, /prisma\.contact\.(create|update|delete|upsert)/);
});

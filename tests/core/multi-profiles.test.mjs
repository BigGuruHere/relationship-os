// Source-level regressions for independent shareable profiles.
// IT: Verify the new opt-in create path leaves existing kind-based context flows intact.
// These fast tests supplement, not replace, browser and database integration tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const manager = read('src/routes/profiles/+page.server.ts');
const page = read('src/routes/profiles/+page.svelte');
const editor = read('src/routes/settings/profile/+page.server.ts');
const form = read('src/routes/settings/profile/+page.svelte');
const capture = read('src/lib/server/core/contactCapture.ts');

test('My Profiles lists all records owned by current account, not one per kind', () => {
  assert.match(manager, /userId: locals\.user\.id/);
  assert.match(manager, /label: true/);
  assert.match(manager, /profiles \};/);
  assert.doesNotMatch(manager, /profiles\.find\(p => p\.kind === kind\)/);
  assert.match(page, /\{#each data\.profiles as profile \(profile\.id\)\}/);
});

test('explicit additional profile is created without looking up a same-kind existing one', () => {
  assert.match(page, /mode=new&kind=business/);
  assert.match(editor, /const creatingNew = fd\.get\('createNewProfile'\) === '1'/);
  assert.match(editor, /: creatingNew \? null : await prisma\.profile\.findFirst/);
  assert.match(editor, /label: label \|\| displayName/);
  assert.match(editor, /if \(creatingNew && profileId\)/);
  assert.match(editor, /if \(requestedProfileSlug && !profile\) throw error\(404/);
  assert.match(form, /name="createNewProfile" value="1"/);
});

test('owner-facing label remains separate from public name and kind', () => {
  assert.match(form, /name="label" bind:value=\{profileLabel\}/);
  assert.match(form, /name="displayName" bind:value=\{displayName\}/);
  assert.match(form, /name="kind" bind:value=\{kind\}/);
  assert.match(page, /profile\.label/);
  assert.match(page, /profile\.kind/);
  assert.match(page, /share\?profile=/);
  assert.match(form, /p\?\.id \? p\.isPublished !== false : !data\?\.creatingNew/);
});

test('legacy contextual profile views keep the established profile on same-kind creation', () => {
  const contextual = read('src/lib/server/core/relishWorkspaceData.ts');
  assert.match(contextual, /orderBy: \[\{ isDefault: 'desc' \}, \{ createdAt: 'asc' \}\]/);
  assert.match(editor, /orderBy: \[\{ isDefault: 'desc' \}, \{ createdAt: 'asc' \}\]/);
});

test('QR contact capture retains exact source profile identity', () => {
  assert.match(capture, /sourceProfileId: profile\.id/);
  assert.match(capture, /profileId: profile\.id/);
  assert.match(capture, /profileKind: profile\.kind/);
});

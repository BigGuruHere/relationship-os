// PURPOSE: Structural checks for the owner-only account administration surface.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
test('user management is capability-routed and owner-gated', () => {
  assert.match(read('src/lib/server/core/capabilities.ts'), /within\('\/settings\/users'\)/);
  const source = read('src/routes/settings/users/+page.server.ts');
  assert.match(source, /locals\.user\.role !== 'owner'/);
  assert.match(source, /assertOwner\(locals\)/);
  assert.match(source, /At least one owner account must remain/);
});
test('grants are restricted to known values and server-validated', () => {
  const source = read('src/routes/settings/users/+page.server.ts');
  assert.match(source, /grantsAllowed = new Set\(\['OPERATOR', 'ADMIN', 'BROKER'\]\)/);
  assert.match(source, /grants\.some\(grant => !grantsAllowed\.has\(grant\)\)/);
  assert.match(source, /tx\.userCapabilityGrant\.createMany/);
});
test('Network provides owner-only user management link', () => {
  const source = read('src/routes/+layout.svelte');
  assert.match(source, /isOwner = data\.accountRole === 'owner'/);
  assert.match(source, /\{#if isOwner\}<a class="nav-link" href="\/settings\/users"/);
});

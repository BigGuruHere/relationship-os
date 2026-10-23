// Stage 8.17 - Static route and security contract checks, no live database needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('app shell exposes the five links independently for each selected context', () => {
  const layout = read('src/routes/+layout.svelte');
  for (const slug of ["label: 'Home'", "label: 'People'", "label: 'Profile'", "label: 'Share'", "label: 'Settings'"])
    assert.ok(layout.includes(slug), slug);
  assert.match(layout, /href=\{activeBase \+ item\.slug\}/);
  assert.match(layout, /spaces\.length > 1/);
  assert.match(layout, /relish-bottom-nav/);
});
test('owner has three contexts but members have only their original QR context', () => {
  const source = read('src/lib/server/core/relishWorkspace.ts');
  assert.match(source, /role === 'owner'/);
  assert.match(source, /pilotProfileEntry\.findFirst/);
  assert.match(source, /firstEntry\?\.domainKey \|\| owned\[0\]/);
  assert.match(source, /if \(!available\.some/);
  assert.match(source, /ownerUserId: locals\.user\.id, domainKey:/);
});
test('server-owned routes use isolated business, friendship and dating custody', () => {
  const source = read('src/lib/server/core/contextDomain.ts');
  assert.match(source, /path === '\/space\/business'/);
  assert.match(source, /path === '\/space\/friendship'/);
  assert.match(source, /path === '\/space\/dating'/);
  assert.match(read('src/routes/space/[context]/+layout.server.ts'), /requireRelishWorkspace/);
});
test('workspaces do not expose legacy broker CRM contacts or private understanding', () => {
  const source = read('src/lib/server/core/relishWorkspaceData.ts');
  assert.match(source, /pilotConnectionRequest\.findMany/);
  assert.match(source, /networkConnectionOrigin\.findMany/);
  assert.doesNotMatch(source, /prisma\.contact\.findMany|livingUnderstanding|transcriptEnc/);
});
test('mobile visitor layout is separate from participant app navigation', () => {
  const source = read('src/routes/+layout.svelte');
  assert.match(source, /path\.startsWith\('\/u\/'\)/);
  assert.match(source, /\{#if !isPublic\}/);
  assert.match(source, /relish-visitor/);
});
test('broker and operator entry points are capability gated while legacy pages remain available', () => {
  const policy = read('src/lib/server/core/capabilities.ts');
  assert.match(policy, /within\('\/broker'\)/);
  assert.match(policy, /within\('\/operator'\)/);
  assert.ok(existsSync(new URL('../../src/routes/broker/contacts/+page.server.ts', import.meta.url)));
  const hub = read('src/routes/operator/+page.svelte');
  assert.match(hub, /product-intelligence/);
  assert.match(hub, /dorian-conversations/);
});
test('owner context bootstrap is explicit and preserves existing contexts', () => {
  const home = read('src/routes/space/[context]/+page.server.ts');
  assert.match(home, /setupAll:/);
  assert.match(home, /ensureOwnedDomainContextSpace/);
  assert.doesNotMatch(read('src/routes/space/[context]/+page.svelte'), /outbound SIP|automatic calling activated/);
});

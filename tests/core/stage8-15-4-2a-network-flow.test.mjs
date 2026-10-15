// PURPOSE: Guard the Network pilot navigation and profile flow without asserting browser integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Network navigation hides context switcher and provides Network-focused links', () => {
  const ui = read('src/routes/+layout.svelte');
  assert.match(ui, /isNetworkSurface \|\| \(data\.user && !canAdmin && !canOperator && !canBroker\)/);
  assert.match(ui, /href="\/network\/share"/);
  assert.match(ui, /href="\/settings\/profile\?kind=personal&entry=network"/);
  assert.match(ui, /\{:else\}\s*\{#if data\.user\}/);
});

test('Network edit and save return to Network without overwriting other profile kinds', () => {
  const server = read('src/routes/settings/profile/+page.server.ts');
  const form = read('src/routes/settings/profile/+page.svelte');
  assert.match(server, /if \(networkEntry && existing && existing\.kind !== 'personal'\)/);
  assert.match(server, /if \(networkEntry\) throw redirect\(303, '\/network'\)/);
  assert.match(server, /networkEntry \? `p-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(form, /name="entry" value="network"/);
  assert.match(form, /name="kind" value="personal"/);
});

test('Network sharing always selects the personal profile and carries return context', () => {
  const source = read('src/routes/network/share/+page.server.ts');
  assert.match(source, /userId: locals\.user\.id, kind: 'personal'/);
  assert.match(source, /entry=network/);
});

test('previously reconciled Prisma index name survives complete-source releases', () => {
  assert.match(read('prisma/schema.prisma'), /@@index\(\[userId, contextSpaceId, interactionId\], map: "GovernedUnderstandingScopeSource_userId_contextSpaceId_interact"\)/);
});

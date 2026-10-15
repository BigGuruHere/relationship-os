// SECURITY: Regression checks for the route-level checks absent from 8.15.4.2c.
// These do not replace HTTP integration tests with owner/member/guest accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const spaces = read('src/routes/settings/context-spaces/+page.server.ts');
const general = read('src/routes/general/+page.server.ts');
const shell = read('src/routes/+layout.svelte');
const policy = read('src/lib/server/core/capabilities.ts');

test('ContextSpace load and each mutation require ADMIN in the handler itself', () => {
  assert.match(spaces, /function requireSpaceAdministrator\(locals: App\.Locals\)/);
  assert.match(spaces, /hasCapability\(locals\.capabilities, 'ADMIN'\)/);
  const handlers = spaces.split(/(?:^export const load:|^\tcreateGeneral:|^\tcreateDating:|^\tselect:)/m).slice(1);
  assert.equal(handlers.length, 4);
  for (const handler of handlers) assert.match(handler, /requireSpaceAdministrator\(locals\)/);
});
test('General root independently enforces OPERATOR', () => {
  assert.match(general, /!hasCapability\(locals\.capabilities, 'OPERATOR'\)/);
  assert.match(general, /throw error\(403/);
});
test('Both privileged surfaces remain gated in request-wide path policy', () => {
  assert.match(policy, /within\('\/settings\/context-spaces'\)/);
  assert.match(policy, /within\('\/general'\).*'OPERATOR'/);
});
test('Network is linked outside General and space management is admin-only in sidebar', () => {
  assert.match(shell, /\{#if data\.user\}<a class="nav-link" href="\/network">Network<\/a>\{\/if\}/);
  assert.match(shell, /\{#if canAdmin\}<a href="\/settings\/context-spaces">Manage spaces<\/a>\{\/if\}/);
});

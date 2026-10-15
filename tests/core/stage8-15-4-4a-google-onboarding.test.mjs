import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
test('registration and login preserve network invitation for Google sign-in', () => {
  assert.match(read('src/routes/auth/register/+page.svelte'), /auth\/google\?next=/);
  assert.match(read('src/routes/auth/login/+page.svelte'), /auth\/google\?next=/);
  assert.match(read('src/routes/network/join/[slug]/+page.svelte'), /auth\/google\?next=/);
});
test('OAuth start stores only validated invitation and discards old next', () => {
  const src = read('src/routes/auth/google/+server.ts');
  assert.match(src, /safeNetworkJoinReturn\(url\.searchParams\.get\('next'\)\)/);
  assert.match(src, /cookies\.set\('oauth_network_next'/);
  assert.match(src, /cookies\.delete\('oauth_network_next'/);
});
test('OAuth callback returns to invitation and cleans the cookie', () => {
  const src = read('src/routes/auth/google/callback/+server.ts');
  assert.match(src, /safeNetworkJoinReturn\(cookies\.get\('oauth_network_next'\)\)/);
  assert.match(src, /cookies\.set\('oauth_network_next', '', base\)/);
  assert.match(src, /redirect\(303, next \|\| '\/'\)/);
});

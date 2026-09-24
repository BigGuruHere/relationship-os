// These unit/contract checks run without a database. Database concurrency and HTTP
// verification are separate checks documented in STAGE8_10_2_INSTALL_AND_TEST.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loginThrottleKey, normalizeLoginEmail } from '../../src/lib/server/loginThrottleKeys.ts';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('email normalization is stable without provider-specific rewrites', () => {
  assert.equal(normalizeLoginEmail('  Alice+Deals@Example.COM  '), 'alice+deals@example.com');
  assert.notEqual(normalizeLoginEmail('alice+deals@example.com'), normalizeLoginEmail('alice@example.com'));
});

test('throttle keys hide inputs, separate kinds, and depend on secret', () => {
  const ip = loginThrottleKey('ip', '192.0.2.1', 'test-secret');
  const account = loginThrottleKey('account', '192.0.2.1', 'test-secret');
  assert.match(ip, /^[0-9a-f]{64}$/);
  assert.equal(ip, loginThrottleKey('ip', '192.0.2.1', 'test-secret'));
  assert.notEqual(ip, account);
  assert.notEqual(ip, loginThrottleKey('ip', '192.0.2.1', 'other-secret'));
  assert.ok(!ip.includes('192.0.2.1'));
  assert.throws(() => loginThrottleKey('ip', '192.0.2.1', ''));
});

test('route verifies hash before password and gates lookup behind both budgets', () => {
  const route = read('src/routes/auth/login/+page.server.ts');
  assert.match(route, /verifyPassword\(user\.passwordHash, password\)/);
  assert.ok(route.indexOf('await consumePasswordLoginAttempt(') < route.indexOf('await findUserByEmail('));
  assert.match(route, /return fail\(429/);
  assert.match(route, /getClientAddress\(\)/);
});

test('migration provisions shared buckets and SQL uses atomic UPSERT', () => {
  const migration = read('prisma/migrations/20260924120000_stage8_10_2_password_login_throttle/migration.sql');
  const implementation = read('src/lib/server/loginThrottle.ts');
  assert.match(migration, /CREATE TABLE "PasswordLoginThrottle"/);
  assert.match(implementation, /ON CONFLICT \("key"\) DO UPDATE/);
  assert.match(implementation, /LEAST\("PasswordLoginThrottle"\."attempts" \+ 1/);
  assert.match(implementation, /return ipAllowed && emailAllowed/);
});

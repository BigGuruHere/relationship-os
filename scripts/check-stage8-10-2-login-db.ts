// Stage 8.10.2 database integration test. Never point this at production.
// Requires a disposable migrated PostgreSQL database in TEST_DATABASE_URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required (disposable migrated database only)');
if (process.env.ALLOW_DISPOSABLE_LOGIN_TEST !== 'YES') {
  throw new Error('Set ALLOW_DISPOSABLE_LOGIN_TEST=YES after verifying the disposable database URL');
}
// Allow testing on the existing development database only
// when the developer explicitly authorises it.
if (
  url === process.env.DATABASE_URL &&
  process.env.ALLOW_SHARED_DEV_LOGIN_TEST !== 'YES'
) {
  throw new Error('Shared database testing requires explicit authorisation');
}
process.env.DATABASE_URL = url;
process.env.LOGIN_THROTTLE_SECRET = `integration-${randomUUID()}`;
// These imports happen after selecting the disposable database.
const [{ prisma }, { consumePasswordLoginAttempt }, { loginThrottleKey, normalizeLoginEmail }] = await Promise.all([
  import('../src/lib/db'),
  import('../src/lib/server/loginThrottle'),
  import('../src/lib/server/loginThrottleKeys')
]);

const suffix = randomUUID();
const touchedKeys: string[] = [];
const secret = process.env.LOGIN_THROTTLE_SECRET!;
async function attempt(ip: string, email: string): Promise<boolean> {
  // Track only this run's keys, so cleanup never touches other records.
  touchedKeys.push(loginThrottleKey('ip', ip, secret));
  touchedKeys.push(loginThrottleKey('account', normalizeLoginEmail(email), secret));
  return consumePasswordLoginAttempt(ip, email);
}
try {
  const account = `test-${suffix}@example.test`;
  const ip = `test-ip-${suffix}`;
  // Eight guesses are accepted; the ninth is throttled even when the IP is fresh.
  for (let i = 0; i < 8; i++) assert.equal(await attempt(`${ip}-${i}`, account), true);
  assert.equal(await attempt(`${ip}-ninth`, account), false);

  // Thirty attempts from a single IP are allowed; the 31st is blocked across emails.
  for (let i = 0; i < 30; i++) {
    assert.equal(await attempt(ip, `test-${suffix}-${i}@example.test`), true);
  }
  assert.equal(await attempt(ip, `test-${suffix}-extra@example.test`), false);

  // Simultaneous requests cannot all pass on the same empty account budget.
  const concurrentEmail = `concurrent-${suffix}@example.test`;
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    attempt(`concurrent-ip-${suffix}-${i}`, concurrentEmail)
  ));
  assert.equal(results.filter(Boolean).length, 8);
  console.log('PASS: PostgreSQL login throttling, IP+account limits and concurrent atomicity');
} finally {
  // A disposable database should be discarded after the test; clean up only this run.
  const keys = [...new Set(touchedKeys)];
  if (keys.length) await prisma.passwordLoginThrottle.deleteMany({ where: { key: { in: keys } } });
  await prisma.$disconnect();
}

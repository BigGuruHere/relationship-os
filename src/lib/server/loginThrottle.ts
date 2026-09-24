// PURPOSE: Distributed password-login throttling backed by PostgreSQL.
// SECURITY: Each request atomically consumes BOTH an IP and a normalized-email budget.
// Only HMAC-derived keys are stored. Neither email addresses nor IPs are persisted here.
// Apply the migration before deploying the login action or the action fails closed.

import { Prisma } from '@prisma/client';
import { prisma } from '$lib/db';
import { loginThrottleKey, normalizeLoginEmail } from './loginThrottleKeys';

export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_IP_LIMIT = 30;
export const LOGIN_ACCOUNT_LIMIT = 8;

function throttleSecret(): string {
  const secret = process.env.LOGIN_THROTTLE_SECRET || process.env.SESSION_COOKIE_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'dev-secret');
  if (!secret || (process.env.NODE_ENV === 'production' && secret === 'dev-secret')) {
    throw new Error('Configure LOGIN_THROTTLE_SECRET or SESSION_COOKIE_SECRET before enabling login');
  }
  return secret;
}

type BucketResult = { attempts: number; expiresAt: Date };

async function consumeBucket(kind: LoginBucket, key: string, limit: number): Promise<boolean> {
  // PostgreSQL's ON CONFLICT acquires a row lock, so concurrent requests to the
  // same bucket cannot both read an old counter and bypass the attempt cap.
  // After expiry, the next request resets that bucket to one attempt.
  const rows = await prisma.$queryRaw<BucketResult[]>(Prisma.sql`
    INSERT INTO "PasswordLoginThrottle" ("key", "kind", "attempts", "expiresAt")
    VALUES (${key}, ${kind}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "PasswordLoginThrottle"."expiresAt" <= NOW() THEN 1
        ELSE LEAST("PasswordLoginThrottle"."attempts" + 1, ${limit + 1})
      END,
      "expiresAt" = CASE
        WHEN "PasswordLoginThrottle"."expiresAt" <= NOW() THEN NOW() + INTERVAL '15 minutes'
        ELSE "PasswordLoginThrottle"."expiresAt"
      END
    RETURNING "attempts", "expiresAt"
  `);
  return rows.length === 1 && rows[0].attempts <= limit;
}

export async function consumePasswordLoginAttempt(ip: string, email: string): Promise<boolean> {
  const secret = throttleSecret();
  // Do not short-circuit: both budgets must be consumed for every attempt.
  const ipAllowed = await consumeBucket('ip', loginThrottleKey('ip', ip, secret), LOGIN_IP_LIMIT);
  const emailAllowed = await consumeBucket(
    'account', loginThrottleKey('account', normalizeLoginEmail(email), secret), LOGIN_ACCOUNT_LIMIT
  );
  return ipAllowed && emailAllowed;
}

export async function clearSuccessfulLoginAccountBucket(email: string): Promise<void> {
  // A successful login clears only the account budget, never the IP budget.
  // This avoids penalizing the account after the owner successfully authenticates.
  const key = loginThrottleKey('account', normalizeLoginEmail(email), throttleSecret());
  await prisma.$executeRaw`DELETE FROM "PasswordLoginThrottle" WHERE "key" = ${key}`;
}

// Pure, dependency-free normalization and pseudonymous key derivation for login throttling.
// Keep this separate from database access so security-critical inputs can be tested directly.
import { createHmac } from 'node:crypto';

export type LoginBucket = 'ip' | 'account';

export function normalizeLoginEmail(value: string): string {
  // Case-fold addresses for consistent buckets; do not apply provider-specific alias rules.
  return value.trim().toLowerCase();
}

export function loginThrottleKey(kind: LoginBucket, raw: string, secret: string): string {
  if (!secret) throw new Error('Login throttle secret is required');
  return createHmac('sha256', secret)
    .update(`relish:login-throttle:v1:${kind}:${raw}`)
    .digest('hex');
}

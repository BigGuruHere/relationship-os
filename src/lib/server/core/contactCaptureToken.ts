// A short-lived form receipt, not an identity or invitation to create a participant account.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { requiredEnv } from '$lib/server/config/requiredEnv';
const TTL = 30 * 60 * 1000;
export const CAPTURE_COOKIE = 'relish_contact_capture';
const mac = (text: string) => createHmac('sha256', requiredEnv('SESSION_COOKIE_SECRET', 24)).update('contact-capture:v1:' + text).digest('base64url');
export function issueContactCaptureToken(profileId: string, browser: string, via: string | null, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ v: 1, profileId, nonce: randomUUID(), browser: mac(browser), issuedAt: now,
    via: via === 'qr' || via === 'event' ? via : 'profile_link' })).toString('base64url');
  return payload + '.' + mac(payload);
}
export function verifyContactCaptureToken(token: unknown, profileId: string, browser: string, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1500 || !browser) throw new Error('Reload this form and try again.');
  const [payload, signature, extra] = token.split('.');
  const expected = Buffer.from(mac(payload || '')); const actual = Buffer.from(signature || '');
  if (extra || actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw new Error('Reload this form and try again.');
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (value.v !== 1 || value.profileId !== profileId || value.browser !== mac(browser) ||
      !/^[0-9a-f-]{36}$/.test(value.nonce) || !Number.isFinite(value.issuedAt) || value.issuedAt > now || now - value.issuedAt > TTL ||
      !['qr','event','profile_link'].includes(value.via)) throw new Error('Reload this form and try again.');
  return { nonce: value.nonce as string, via: value.via as 'qr' | 'event' | 'profile_link' };
}

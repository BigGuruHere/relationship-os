// src/lib/auth.ts
// PURPOSE:
// - Minimal email+password auth with Argon2id and signed sessions
// - Env-aware cookie helpers that use locals.sessionCookie for name and flags
//
// SECURITY NOTES:
// - Store Argon2id hashes only
// - Use HTTP only cookies with SameSite=lax or strict
// - Rotate sessions on login and logout
// - Keep token material server side only

import type { Cookies } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import * as argon2 from 'argon2'; // Argon2id by default from this lib
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { dev } from '$app/environment'; // kept for legacy helpers

// Secret and lifetime
const SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || 'dev-secret'; // do not rely on this in prod
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '30', 10);

if (process.env.NODE_ENV === 'production' && SESSION_COOKIE_SECRET === 'dev-secret') {
  throw new Error('SESSION_COOKIE_SECRET must be set in production');
}

// ---------------------------------------------------------------------------
// Token signing helpers
// ---------------------------------------------------------------------------

// Sign a value with HMAC-SHA256
function sign(value: string): string {
  // Use constant time compare during verify
  const mac = createHmac('sha256', SESSION_COOKIE_SECRET).update(value).digest('base64url');
  return `${value}.${mac}`;
}

// Verify HMAC and return payload part if valid
function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac('sha256', SESSION_COOKIE_SECRET).update(value).digest('base64url');
  // timing safe compare
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? value : null;
}

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

// Hash a password with Argon2id
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Verify a password
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Session create and verify
// ---------------------------------------------------------------------------

// Create a new session for a user and return the cookie payload and expiry
export async function createSession(userId: string) {
  // Token is random 32 bytes, we store a hash of it in DB so a leaked DB cannot impersonate
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHmac('sha256', SESSION_COOKIE_SECRET).update(rawToken).digest('base64url');

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: { userId, tokenHash, expiresAt }
  });

  // Cookie value contains session id and raw token
  const cookiePayload = JSON.stringify({ id: session.id, t: rawToken });
  const signedValue = sign(Buffer.from(cookiePayload).toString('base64url'));

  return { cookie: signedValue, expiresAt };
}

// Verify session from a signed cookie string
export async function getSessionFromCookie(cookieStr: string | undefined) {
  if (!cookieStr) return null;
  const unsigned = unsign(cookieStr);
  if (!unsigned) return null;
  try {
    const payload = JSON.parse(Buffer.from(unsigned, 'base64url').toString('utf8')) as { id: string; t: string };
    // Re-hash provided token and compare with stored hash
    const tokenHash = createHmac('sha256', SESSION_COOKIE_SECRET).update(payload.t).digest('base64url');
    const session = await prisma.session.findUnique({ where: { id: payload.id } });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    const a = Buffer.from(session.tokenHash);
    const b = Buffer.from(tokenHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return null;
    return { user, session };
  } catch {
    return null;
  }
}

// Destroy a session by id
export async function destroySession(sessionId: string) {
  try {
    await prisma.session.delete({ where: { id: sessionId } });
  } catch {
    // ignore missing rows
  }
}

// ---------------------------------------------------------------------------
// Env-aware cookie helpers - preferred API
// ---------------------------------------------------------------------------

// Read the session token value using the env-aware cookie name from locals
export function readSessionToken(cookies: Cookies, locals: App.Locals): string | undefined {
  const cookieName = locals.sessionCookie.name;
  return cookies.get(cookieName);
}

// Set the session cookie using env-aware name and flags from locals
export function setSessionCookie(cookies: Cookies, locals: App.Locals, value: string, expiresAt?: Date): void {
  const { name, options } = locals.sessionCookie;
  // Use options from locals, and add an explicit expires if provided
  const finalOptions = expiresAt ? { ...options, expires: expiresAt } : options;
  cookies.set(name, value, finalOptions);
}

// Clear the session cookie using at least the same path used during set
export function clearSessionCookie(cookies: Cookies, locals: App.Locals): void {
  const { name } = locals.sessionCookie;
  cookies.delete(name, { path: '/' });
}

// Build cookie options from locals plus a specific expiry date
export function sessionCookieOptions(locals: App.Locals, expiresAt: Date) {
  return { ...locals.sessionCookie.options, expires: expiresAt };
}

// ---------------------------------------------------------------------------
// Legacy helpers - keep for compatibility while you migrate callers
// ---------------------------------------------------------------------------

// Legacy constant name - avoid using this in new code
// New code should read the name from locals.sessionCookie.name
export const SESSION_COOKIE_NAME = 'rsid';

// Legacy attributes helper - avoid using in new code
// New code should call sessionCookieOptions(locals, expiresAt)
export function sessionCookieAttributes(expiresAt: Date) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !dev,
    expires: expiresAt
  };
}

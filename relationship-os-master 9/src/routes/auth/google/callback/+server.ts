// src/routes/auth/google/callback/+server.ts
// PURPOSE: exchange code for tokens, verify ID token, upsert OAuthAccount, create first party session
// SECURITY NOTES:
// - Validate state to prevent CSRF
// - Validate nonce in ID token to stop replay
// - Verify ID token signature and audience using Google's JWKS
// - Link to an existing user by OAuthAccount or by encrypted email index, or create a new user
// - Never write plaintext email to the database
// - Decrypt email server-side only when a string email is required for lead linking
// - Clear temporary OAuth cookies after use
// - All IT code is commented and avoids em dash characters

import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { createSession, setSessionCookie } from '$lib/auth';
import * as jose from 'jose';
import { linkLeadsForUser } from '$lib/leads/link';
import { ensureDefaultProfile } from '$lib/server/profiles';

// IT: encrypted email helpers - equality lookup and write
import { findUserByEmail, setUserEmail, decryptUserEmail } from '$lib/server/userEmail';

// Google endpoints
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

// Simple best effort rate limit - 5 hits per 60s per IP for local dev
const WINDOW_MS = 60_000;
const MAX_HITS = 5;
const rl = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string) {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || e.resetAt < now) {
    rl.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  e.count += 1;
  if (e.count > MAX_HITS) throw error(429, 'Too many login attempts. Please try again shortly.');
}

// Helper to clear our short lived OAuth cookies
function clearTempCookies(
  cookies: import('@sveltejs/kit').Cookies,
  // secure flag should match current env - pass from locals
  secure: boolean
) {
  const base = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure, maxAge: 0 };
  cookies.set('oauth_state', '', base);
  cookies.set('oauth_nonce', '', base);
  cookies.set('oauth_pkce', '', base);
}

export const GET: RequestHandler = async ({ url, cookies, locals, getClientAddress, fetch }) => {
  // 1 - rate limit by IP
  const ip = getClientAddress?.() || 'unknown';
  checkRateLimit(`oauth:${ip}`);

  // 2 - required query params
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';

  // 3 - cookies that the start route set
  const storedState = cookies.get('oauth_state') || '';
  const nonceCookie = cookies.get('oauth_nonce') || '';
  const codeVerifier = cookies.get('oauth_pkce') || '';

  // 4 - basic validation
  if (!code || !state || !storedState || !codeVerifier) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Invalid OAuth callback');
  }
  if (state !== storedState) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'State mismatch');
  }

  // 5 - exchange code for tokens at Google
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, `Token exchange failed: ${body.slice(0, 200)}`);
  }

  const token = await tokenRes.json();

  // 6 - verify ID token with Google's JWKS
  const idToken = token.id_token as string;
  if (!idToken) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Missing id_token');
  }

  const jwks = jose.createRemoteJWKSet(new URL(JWKS_URI));
  const { payload } = await jose.jwtVerify(idToken, jwks, { audience: clientId });

  // 7 - optional nonce binding if you set one during start
  if (nonceCookie && payload.nonce && payload.nonce !== nonceCookie) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Nonce mismatch');
  }

  // 8 - extract identity from the ID token
  const sub = String(payload.sub);
  const emailRaw = String(payload.email || '');
  const emailVerified = Boolean(payload.email_verified);
  if (!emailRaw || !emailVerified) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Email not verified with Google');
  }

  // 9 - optional email domain guard for early testing
  function isEmailAllowed(emailAddr: string): boolean {
    const one = process.env.ALLOWED_GOOGLE_DOMAIN || '';
    const many = process.env.ALLOWED_EMAIL_DOMAINS || '';
    if (!one && !many) return true;
    const domain = emailAddr.split('@')[1]?.toLowerCase() || '';
    if (one && domain === one.toLowerCase()) return true;
    if (many) {
      const set = new Set(
        many
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      );
      if (set.has(domain) || set.has(emailAddr.toLowerCase())) return true;
    }
    return false;
  }

  if (!isEmailAllowed(emailRaw)) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(403, 'This email is not allowed for login');
  }

  // 10 - normalize email for deterministic indexing
  const email = emailRaw.trim().toLowerCase();

  // 11 - resolve or create user
  const provider = 'google' as const;

  // 11a - first try find by existing OAuth link
  let user = await prisma.user.findFirst({
    where: {
      oauthAccounts: { some: { provider, providerAccountId: sub } }
    },
    select: { id: true }
  });

  // 11b - else try by encrypted email index via helper
  if (!user) {
    const existingByEmail = await findUserByEmail(email);
    if (existingByEmail) {
      user = { id: existingByEmail.id };
    }
  }

  // 11c - create user if none found, then set encrypted email fields
  if (!user) {
    const created = await prisma.user.create({
      data: {},
      select: { id: true }
    });
    await setUserEmail(created.id, email);
    user = created;
  } else {
    // IT: ensure legacy users get encrypted email fields backfilled
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email_Enc: true, email_Idx: true }
    });
    if (!u?.email_Enc || !u?.email_Idx) {
      await setUserEmail(user.id, email);
    }
  }

  // 11d - ensure a default profile exists for this user using friendly seeds from Google
  // - prefer Google's name, fall back to the email local part
  // - avatar is optional and safe to set here
  try {
    const seedName =
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : email.split('@')[0];
    const seedAvatar =
      typeof payload.picture === 'string' && payload.picture.trim()
        ? payload.picture.trim()
        : null;
    await ensureDefaultProfile(user.id, { displayName: seedName, avatarUrl: seedAvatar });
  } catch (e) {
    // IT: do not block login if profile creation fails
    console.warn('ensureDefaultProfile failed after Google OAuth:', e);
  }

  // 12 - upsert the OAuth account record for this user
  const existingAcct = await prisma.oAuthAccount.findFirst({
    where: { userId: user.id, provider, providerAccountId: sub }
  });

  const expiresAt =
    token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000) : null;

  if (!existingAcct) {
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerAccountId: sub,
        accessToken: token.access_token || null,
        refreshToken: token.refresh_token || null,
        expiresAt
      }
    });
  } else {
    await prisma.oAuthAccount.update({
      where: { id: existingAcct.id },
      data: {
        accessToken: token.access_token || null,
        refreshToken: token.refresh_token || null,
        expiresAt
      }
    });
  }

  // 13 - clear temp cookies after successful verification
  clearTempCookies(cookies, locals.sessionCookie.options.secure);

  // 14 - create a first party session cookie using env aware helpers
  const sess = await createSession(user.id);
  setSessionCookie(cookies, locals, sess.cookie, sess.expiresAt);

  // 15 - post auth linking - decrypt server-side to pass a string email to the linker
  try {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email_Enc: true }
    });
    const emailPlain = decryptUserEmail(u?.email_Enc ?? null);
    if (emailPlain) {
      await linkLeadsForUser(user.id, emailPlain);
    }
  } catch (e) {
    // Never block login on lead linking - log and continue
    console.warn('linkLeadsForUser failed after Google OAuth:', e);
  }

  // 16 - home sweet home
  throw redirect(303, '/');
};

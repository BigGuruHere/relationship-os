import { googleControlsMailbox } from '$lib/server/googleEmailAuthority';
import { recordGoogleEmailProof } from '$lib/server/foundation/accountChannels';
import { exchangeBrowserEnabled } from '$lib/server/foundation/devPilotGate';
import { accountDomain, provisionNewFoundationAccount } from '$lib/server/foundation/provisioning';
import { EXCHANGE_RETURN, startExchangeAfterAuth, finishVerifiedExchange } from '$lib/server/exchangeOnboarding';
import { requiredEnv } from '$lib/server/config/requiredEnv';
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
import { safeAuthReturn } from '$lib/server/networkJoinReturn';
import { finishProfileAuth, readProfileDraft, PROFILE_ONBOARDING_RETURN } from '$lib/server/profileOnboarding';
import { prisma } from '$lib/db';
import { createSession, setSessionCookie } from '$lib/auth';
import * as jose from 'jose';
import { linkLeadsForUser } from '$lib/leads/link';
import { defaultProfileData, ensureDefaultProfile } from '$lib/server/profiles';

// IT: encrypted email helpers - equality lookup and write
import { findUserByEmail, setUserEmail, decryptUserEmail, encryptedUserEmailFields } from '$lib/server/userEmail';

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
  cookies.set('oauth_network_next', '', base);
}

// Existing legacy accounts retain their optional workspace login restrictions.
function legacyGoogleEmailAllowed(email: string) {
  const domain = email.split('@')[1];
  const legacyDomain = process.env.ALLOWED_GOOGLE_DOMAIN?.toLowerCase();
  const legacyList = process.env.ALLOWED_EMAIL_DOMAINS;
  const legacyEntries = legacyList?.split(',').map(entry => entry.trim().toLowerCase()).filter(Boolean);
  return (!legacyDomain && !legacyList) || Boolean(legacyDomain && domain === legacyDomain) ||
    Boolean(legacyEntries?.some(entry => entry === domain || entry === email));
}

export const GET: RequestHandler = async ({ url, cookies, locals, getClientAddress, fetch }) => {
  // 1 - rate limit by IP
  const ip = getClientAddress?.() || 'unknown';
  checkRateLimit(`oauth:${ip}`);

  // 2 - required query params
  // IT: Read before clearing temporary OAuth cookies; never trust an arbitrary redirect.
  const next = safeAuthReturn(cookies.get('oauth_network_next'));
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
  const clientId = requiredEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requiredEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = requiredEnv('OAUTH_REDIRECT_URI');

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
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Google sign-in could not be completed.');
  }

  const token = await tokenRes.json();

  // 6 - verify ID token with Google's JWKS
  const idToken = token.id_token as string;
  if (!idToken) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Missing id_token');
  }

  const jwks = jose.createRemoteJWKSet(new URL(JWKS_URI));
  const { payload } = await jose.jwtVerify(idToken, jwks, { audience: clientId, issuer:['https://accounts.google.com','accounts.google.com'], requiredClaims:['exp','iat','sub','email','email_verified','nonce'], maxTokenAge:'10 minutes' });

  // 7 - optional nonce binding if you set one during start
  if (!nonceCookie || payload.nonce !== nonceCookie) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Nonce mismatch');
  }

  // 8 - extract identity from the ID token
  const sub = typeof payload.sub==='string'?payload.sub:'';
  const emailRaw = typeof payload.email==='string'?payload.email:'';
  const emailVerified = payload.email_verified === true;
  if (!sub || !emailRaw || !emailVerified) {
    clearTempCookies(cookies, locals.sessionCookie.options.secure);
    throw error(400, 'Email not verified with Google');
  }

  const email = emailRaw.trim().toLowerCase();
  const provider = 'google' as const;
  const providerIdentity = { provider, providerAccountId: sub };
  const tokenFields = {
    accessToken: token.access_token || null,
    refreshToken: token.refresh_token || null,
    expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000) : null
  };

  // A previously linked Google subject is authoritative. Preserve the legacy email
  // lookup for legacy accounts only; a matching address must not open a private vault.
  const findLinkedUser = () => prisma.user.findFirst({
    where: { oauthAccounts: { some: providerIdentity } },
    select: { id: true }
  });
  let user = await findLinkedUser();
  if (!user) {
    const existing = await findUserByEmail(email);
    if (existing) {
      // A concurrent callback may have completed the same Google link after our first lookup.
      user = await findLinkedUser();
      if (!user && await accountDomain(existing.id) !== 'LEGACY') {
        clearTempCookies(cookies, locals.sessionCookie.options.secure);
        throw error(409, 'Sign in with the method you used to create your Relish account.');
      }
      user ??= { id: existing.id };
    }
  }

  const onboarding = next === PROFILE_ONBOARDING_RETURN || next === EXCHANGE_RETURN;
  const seed = {
    displayName: typeof payload.name === 'string' ? payload.name.trim().slice(0, 200) : null,
    avatarUrl: typeof payload.picture === 'string' ? payload.picture.trim() : null
  };
  let newProfileId: string | undefined;
  let legacy = false;
  if (!user) {
    const draft = onboarding ? readProfileDraft(cookies) : null;
    try {
      // The provider link, encrypted credentials, private card and vault commit together.
      const created = await prisma.$transaction(async tx => {
        const account = await tx.user.create({
          data: {
            ...encryptedUserEmailFields(email),
            person: { create: {} },
            profiles: { create: defaultProfileData({
              ...seed, displayName: draft?.name || seed.displayName, isPublished: false
            }) },
            // The provider subject is enough for sign-in. Foundation does not retain OAuth bearer tokens.
            oauthAccounts: { create: providerIdentity }
          },
          select: { id: true, profiles: { select: { id: true } } }
        });
        await provisionNewFoundationAccount(tx, account.id);
        return account;
      });
      user = created;
      newProfileId = created.profiles[0].id;
    } catch (failure) {
      if ((failure as { code?: string })?.code !== 'P2002') {
        clearTempCookies(cookies, locals.sessionCookie.options.secure);
        throw error(503, 'Could not create your account. Please try again.');
      }
      // A duplicate provider callback can resume. A different identity racing
      // for the same email gets no session and must use the original sign-in.
      user = await findLinkedUser();
      if (!user) {
        clearTempCookies(cookies, locals.sessionCookie.options.secure);
        throw error(409, 'Sign in with the method you used to create your Relish account.');
      }
    }
  } else {
    legacy = await accountDomain(user.id) === 'LEGACY';
    if (legacy && !legacyGoogleEmailAllowed(email)) {
      clearTempCookies(cookies, locals.sessionCookie.options.secure);
      throw error(403, 'This email is not allowed for login');
    }
    // Existing profiles keep their publication state. Missing Foundation cards
    // must be recreated privately, even when the login has no onboarding return.
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email_Enc: true, email_Idx: true }
    });
    if (!u?.email_Enc || !u?.email_Idx) await setUserEmail(user.id, email);
    try {
      const privateDefault = onboarding || !legacy;
      await ensureDefaultProfile(user.id, { ...seed, ...(privateDefault ? { isPublished: false } : {}) });
    } catch {
      console.warn('ensureDefaultProfile failed after Google OAuth.');
    }

    if (legacy) {
      const link = await prisma.oAuthAccount.upsert({
        where: { provider_providerAccountId: providerIdentity },
        create: { userId: user.id, ...providerIdentity, ...tokenFields },
        update: {},
        select: { userId: true }
      });
      // Never overwrite another account's provider credentials during a link race.
      if (link.userId !== user.id) throw error(409, 'Google sign-in could not be completed.');
      await prisma.oAuthAccount.update({
        where: { provider_providerAccountId: providerIdentity },
        data: tokenFields
      });
    }
  }

  // 13 - clear temp cookies after successful verification
  clearTempCookies(cookies, locals.sessionCookie.options.secure);

  // 14 - create a first party session cookie using env aware helpers
  const sess = await createSession(user.id);
  setSessionCookie(cookies, locals, sess.cookie, sess.expiresAt);
  await startExchangeAfterAuth(cookies, url, locals, next, user.id, sess.sessionId);

  // Only newly validated callbacks can establish account email assurance. This never blocks login
  // or reactivates revoked channels; credentials and private domain enrollment remain independent.
  if (googleControlsMailbox(email, payload.hd) && exchangeBrowserEnabled(locals, url.origin)) {
    try {
      if (await accountDomain(user.id) === 'ACTIVE') {
        await recordGoogleEmailProof({ ...locals, user: { id: user.id }, sessionId: sess.sessionId }, email);
      }
    } catch {
      console.warn('Google account-channel proof could not be recorded.');
    }
  }
  const followup = await finishVerifiedExchange(cookies, url, locals, next, user.id, sess.sessionId);
  if (followup) throw redirect(303, followup);
  if (onboarding || newProfileId) {
    const destination = onboarding ? next : PROFILE_ONBOARDING_RETURN;
    throw redirect(303, finishProfileAuth(cookies, url, destination, user.id, newProfileId));
  }

  if (!legacy) throw redirect(303, next || '/');

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
  throw redirect(303, next || '/');
};

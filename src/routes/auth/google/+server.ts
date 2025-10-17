// src/routes/auth/google/+server.ts
// PURPOSE:
// - Start Google OAuth by generating state, nonce, and PKCE
// - Store short lived cookies for state, nonce, and pkce
// - Redirect to Google's authorization endpoint
// NOTES:
// - Uses env-aware secure flag from locals.sessionCookie so cookies work in dev and prod
// - All IT code is commented and uses normal hyphens

import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { randomBytes, createHash } from 'crypto';

// Google endpoints
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// Base64url helper
function b64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// Build a code challenge from a verifier
function toCodeChallenge(verifier: string) {
  const hash = createHash('sha256').update(verifier).digest();
  return b64url(hash);
}

export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

  if (!clientId) throw error(500, 'Missing GOOGLE_CLIENT_ID');
  if (!redirectUri) throw error(500, 'Missing OAUTH_REDIRECT_URI');

  // Generate CSRF and replay protection values
  const state = b64url(randomBytes(16));
  const nonce = b64url(randomBytes(16));
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = toCodeChallenge(codeVerifier);

  // Short lived cookie attributes
  // - secure flag comes from env-aware session cookie config
  const baseCookie = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: locals.sessionCookie.options.secure,
    maxAge: 10 * 60 // 10 minutes
  };

  // Store temporary OAuth cookies
  cookies.set('oauth_state', state, baseCookie);
  cookies.set('oauth_nonce', nonce, baseCookie);
  cookies.set('oauth_pkce', codeVerifier, baseCookie);

  // Optional prompt and access settings
  const prompt = url.searchParams.get('prompt') || 'consent'; // allow override if needed

  // Build the Google authorization URL
  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('prompt', prompt);

  // Off you go
  throw redirect(302, authUrl.toString());
};

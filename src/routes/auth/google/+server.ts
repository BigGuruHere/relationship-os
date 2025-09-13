// PURPOSE: initiate Google OAuth 2.0 Authorization Code with PKCE
// SECURITY NOTES:
// - Use state to prevent CSRF
// - Use nonce to bind the ID token
// - Use PKCE to protect the code exchange
// - Store state, nonce, and code_verifier in short lived httpOnly cookies

import type { RequestHandler } from './$types'
import { randomBytes, createHash } from 'crypto'
import { dev } from '$app/environment'

function b64url(input: Buffer | string) {
  // Convert to base64url without padding
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const GET: RequestHandler = async ({ cookies }) => {
  // Generate CSRF state and ID token nonce
  const state = b64url(randomBytes(16))
  const nonce = b64url(randomBytes(16))

  // PKCE - create a high entropy code_verifier and a S256 code_challenge
  const codeVerifier = b64url(randomBytes(32))
  const codeChallenge = b64url(createHash('sha256').update(codeVerifier).digest())

  // Persist short lived cookies so we can validate in the callback
  const baseCookie = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: !dev, maxAge: 600 }
  cookies.set('oauth_state', state, baseCookie)
  cookies.set('oauth_nonce', nonce, baseCookie)
  cookies.set('oauth_pkce', codeVerifier, baseCookie)

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: process.env.OAUTH_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // If you later need refresh tokens, add access_type=offline and possibly prompt=consent
    // access_type: 'offline',
    // prompt: 'consent',
  })

  return new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` }
  })
}

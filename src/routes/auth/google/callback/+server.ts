// PURPOSE: exchange code for tokens, verify ID token, upsert OAuthAccount, create first party session
// SECURITY NOTES:
// - Validate state to prevent CSRF
// - Validate nonce in ID token to stop replay
// - Verify ID token signature and audience using Google's JWKS
// - Link to an existing user by OAuthAccount or by email, or create a new user

import type { RequestHandler } from './$types'
import { json, redirect } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { createSession, sessionCookieAttributes, SESSION_COOKIE_NAME } from '$lib/auth'
import * as jose from 'jose' // npm i jose
import { dev } from '$app/environment'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'

// JWK set is cached by jose to avoid repeated network calls
const jwks = jose.createRemoteJWKSet(new URL(JWKS_URI))

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // Read and clear CSRF state, nonce, and PKCE verifier
  const storedState = cookies.get('oauth_state') || null
  const storedNonce = cookies.get('oauth_nonce') || null
  const codeVerifier = cookies.get('oauth_pkce') || null
  cookies.delete('oauth_state', { path: '/' })
  cookies.delete('oauth_nonce', { path: '/' })
  cookies.delete('oauth_pkce', { path: '/' })

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    return json({ error: 'Invalid state or code' }, { status: 400 })
  }

  // Exchange authorization code for tokens
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: process.env.OAUTH_REDIRECT_URI || '',
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  })

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return json({ error: 'Token exchange failed', detail: text }, { status: 400 })
  }

  const token = await tokenRes.json() as {
    id_token: string
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  // Verify ID token
  const { payload } = await jose.jwtVerify(token.id_token, jwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_CLIENT_ID
  })

  // Validate nonce to prevent replay
  if (!storedNonce || payload.nonce !== storedNonce) {
    return json({ error: 'Invalid nonce' }, { status: 400 })
  }

  // Extract Google subject and email
  const googleSub = String(payload.sub || '')
  const email = payload.email ? String(payload.email) : ''
  if (!googleSub) return json({ error: 'Missing Google subject' }, { status: 400 })

  // Try to find an existing account link
  let account = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleSub } },
    include: { user: true }
  })

  let user = account?.user || null

  // If no linked account, try to link by email or create a new user
  if (!user) {
    if (email) {
      user = await prisma.user.findUnique({ where: { email } })
    }
    if (!user) {
      // Create user with placeholder passwordHash since login is via Google
      user = await prisma.user.create({
        data: { email: email || `user-${googleSub}@example.local`, passwordHash: 'oauth' }
      })
    }

    // Create the OAuth link
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerAccountId: googleSub,
        email: email || null,
        accessToken: token.access_token || null,
        refreshToken: token.refresh_token || null,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
      }
    })
  }

  // Create a first party session cookie exactly like password login
  const { cookie, expiresAt } = await createSession(user.id)
  cookies.set(SESSION_COOKIE_NAME, cookie, sessionCookieAttributes(expiresAt))

  // Redirect to home after successful login
  throw redirect(303, '/')
}

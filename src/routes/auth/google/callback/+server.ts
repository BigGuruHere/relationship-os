// src/routes/auth/google/callback/+server.ts
// PURPOSE: exchange code for tokens, verify ID token, upsert OAuthAccount, create first party session
// SECURITY NOTES:
// - Validate state to prevent CSRF
// - Validate nonce in ID token to stop replay
// - Verify ID token signature and audience using Google's JWKS
// - Link to an existing user by OAuthAccount or by email, or create a new user
// - Clear temporary OAuth cookies after use
// - All IT code is commented and avoids emdash characters

import type { RequestHandler } from './$types'
import { redirect, error } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { createSession, sessionCookieAttributes, SESSION_COOKIE_NAME } from '$lib/auth'
import * as jose from 'jose'
import { dev } from '$app/environment'

// Google endpoints
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'

// Simple best effort rate limit - 5 hits per 60s per IP for local dev
const WINDOW_MS = 60_000
const MAX_HITS = 5
const rl = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string) {
  const now = Date.now()
  const e = rl.get(key)
  if (!e || e.resetAt < now) {
    rl.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  e.count += 1
  if (e.count > MAX_HITS) throw error(429, 'Too many login attempts. Please try again shortly.')
}

// Helper to clear our short lived OAuth cookies
function clearTempCookies(cookies: import('@sveltejs/kit').Cookies) {
  const base = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: !dev, maxAge: 0 }
  cookies.set('oauth_state', '', base)
  cookies.set('oauth_nonce', '', base)
  cookies.set('oauth_pkce', '', base)
}

// Optional email domain guard for early testing
function isEmailAllowed(email: string): boolean {
  const one = process.env.ALLOWED_GOOGLE_DOMAIN || ''
  const many = process.env.ALLOWED_EMAIL_DOMAINS || ''
  if (!one && !many) return true
  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (one && domain === one.toLowerCase()) return true
  if (many) {
    const set = new Set(
      many
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
    if (set.has(domain) || set.has(email.toLowerCase())) return true
  }
  return false
}

export const GET: RequestHandler = async ({ url, cookies, getClientAddress }) => {
  // Rate limit by IP
  const ip = getClientAddress?.() || 'unknown'
  checkRateLimit(`oauth:${ip}`)

  // Required query params
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''

  // Cookies that the start route set
  const storedState = cookies.get('oauth_state') || ''
  const nonceCookie = cookies.get('oauth_nonce') || ''
  const codeVerifier = cookies.get('oauth_pkce') || '' // FIX - match start route cookie name

  // Basic validation
  if (!code || !state || !storedState || !codeVerifier) {
    clearTempCookies(cookies)
    throw error(400, 'Invalid OAuth callback')
  }
  if (state !== storedState) {
    clearTempCookies(cookies)
    throw error(400, 'State mismatch')
  }

  // Exchange code for tokens at Google
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/google/callback'

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  })

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '')
    clearTempCookies(cookies)
    throw error(400, `Token exchange failed: ${body.slice(0, 200)}`)
  }

  const token = await tokenRes.json()

  // Verify ID token with Google's JWKS
  const idToken = token.id_token as string
  if (!idToken) {
    clearTempCookies(cookies)
    throw error(400, 'Missing id_token')
  }

  const jwks = jose.createRemoteJWKSet(new URL(JWKS_URI))
  const { payload } = await jose.jwtVerify(idToken, jwks, { audience: clientId })

  // Optional nonce binding if you set one during start
  if (nonceCookie && payload.nonce && payload.nonce !== nonceCookie) {
    clearTempCookies(cookies)
    throw error(400, 'Nonce mismatch')
  }

  // Extract identity
  const sub = String(payload.sub)
  const email = String(payload.email || '')
  const emailVerified = Boolean(payload.email_verified)
  if (!email || !emailVerified) {
    clearTempCookies(cookies)
    throw error(400, 'Email not verified with Google')
  }

  // Optional allowlist
  if (!isEmailAllowed(email)) {
    clearTempCookies(cookies)
    throw error(403, 'This email is not allowed for login')
  }

  // Upsert user and OAuth account
  const provider = 'google' as const
  let user = await prisma.user.findFirst({ where: { email } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        oauthAccounts: {
          create: {
            provider,
            providerAccountId: sub,
            accessToken: token.access_token || null,
            refreshToken: token.refresh_token || null,
            expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
          }
        }
      }
    })
  } else {
    const existing = await prisma.oAuthAccount.findFirst({
      where: { userId: user.id, provider, providerAccountId: sub }
    })
    if (!existing) {
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider,
          providerAccountId: sub,
          accessToken: token.access_token || null,
          refreshToken: token.refresh_token || null,
          expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
        }
      })
    } else {
      await prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: token.access_token || null,
          refreshToken: token.refresh_token || null,
          expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
        }
      })
    }
  }

  // Clear temp cookies after successful verification
  clearTempCookies(cookies)

  // Create a first party session cookie
  const { cookie, expiresAt } = await createSession(user.id)
  cookies.set(SESSION_COOKIE_NAME, cookie, sessionCookieAttributes(expiresAt))

  // Home sweet home
  throw redirect(303, '/')
}

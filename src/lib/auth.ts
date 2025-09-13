// PURPOSE: Minimal email+password auth with Argon2id and signed sessions
// SECURITY NOTES:
// - Store Argon2id hashes only
// - Use HTTP only cookies with SameSite=lax or strict
// - Rotate sessions on login and logout
// - Keep token material server side only

import { prisma } from '$lib/db'
import * as argon2 from 'argon2' // Argon2id by default from this lib
import { randomBytes, createHmac, timingSafeEqual } from 'crypto'
import { dev } from '$app/environment'

const SESSION_COOKIE = 'rsid' // Relationship OS session id
const SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || 'dev-secret' // do not rely on this in prod
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '30', 10)

// sign a value with HMAC-SHA256
function sign(value: string): string {
  // Use constant time compare during verify
  const mac = createHmac('sha256', SESSION_COOKIE_SECRET).update(value).digest('base64url')
  return `${value}.${mac}`
}

// verify HMAC and return payload part if valid
function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.')
  if (idx <= 0) return null
  const value = signed.slice(0, idx)
  const mac = signed.slice(idx + 1)
  const expected = createHmac('sha256', SESSION_COOKIE_SECRET).update(value).digest('base64url')
  // timing safe compare
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? value : null
}

// hash a password with Argon2id
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

// verify a password
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

// create a new session for a user
export async function createSession(userId: string) {
  // token is random 32 bytes, we store a hash of it in DB so leaked DB cannot impersonate
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = createHmac('sha256', SESSION_COOKIE_SECRET).update(rawToken).digest('base64url')

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  const session = await prisma.session.create({
    data: { userId, tokenHash, expiresAt }
  })

  // cookie value contains session id and raw token
  const cookiePayload = JSON.stringify({ id: session.id, t: rawToken })
  const signedValue = sign(Buffer.from(cookiePayload).toString('base64url'))

  return { cookie: signedValue, expiresAt }
}

// verify session from cookie string
export async function getSessionFromCookie(cookieStr: string | undefined) {
  if (!cookieStr) return null
  const unsigned = unsign(cookieStr)
  if (!unsigned) return null
  try {
    const payload = JSON.parse(Buffer.from(unsigned, 'base64url').toString('utf8')) as { id: string; t: string }
    // re hash provided token and compare with stored hash
    const tokenHash = createHmac('sha256', SESSION_COOKIE_SECRET).update(payload.t).digest('base64url')
    const session = await prisma.session.findUnique({ where: { id: payload.id } })
    if (!session) return null
    if (session.expiresAt.getTime() <= Date.now()) return null
    const a = Buffer.from(session.tokenHash)
    const b = Buffer.from(tokenHash)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) return null
    return { user, session }
  } catch {
    return null
  }
}

// destroy a session by id
export async function destroySession(sessionId: string) {
  try {
    await prisma.session.delete({ where: { id: sessionId } })
  } catch {
    // ignore missing rows
  }
}

// cookie attributes helper
export function sessionCookieAttributes(expiresAt: Date) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !dev,
    expires: expiresAt
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE

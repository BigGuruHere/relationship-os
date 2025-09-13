// PURPOSE: invalidate the current session and clear cookie
import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'
import { destroySession, SESSION_COOKIE_NAME } from '$lib/auth'

export const POST: RequestHandler = async ({ locals, cookies }) => {
  if (locals.sessionId) {
    await destroySession(locals.sessionId)
  }
  // Clear cookie with an immediate expiry
  cookies.set(SESSION_COOKIE_NAME, '', { path: '/', httpOnly: true, sameSite: 'lax', secure: true, expires: new Date(0) })
  return json({ ok: true })
}

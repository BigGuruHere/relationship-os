// PURPOSE: Read the signed session cookie on every request and attach user to locals
// All server load functions and actions can trust locals.user when present

import type { Handle } from '@sveltejs/kit'
import { getSessionFromCookie, SESSION_COOKIE_NAME } from '$lib/auth'

export const handle: Handle = async ({ event, resolve }) => {
  const cookie = event.cookies.get(SESSION_COOKIE_NAME)
  const session = await getSessionFromCookie(cookie)
  if (session) {
    // Attach minimal user info to locals to avoid leaking passwordHash
    event.locals.user = { id: session.user.id, email: session.user.email }
    event.locals.sessionId = session.session.id
  } else {
    event.locals.user = null
    event.locals.sessionId = null
  }
  return resolve(event)
}

// Type augmentation for locals
declare module '@sveltejs/kit' {
  interface Locals {
    user: { id: string; email: string } | null
    sessionId: string | null
  }
}

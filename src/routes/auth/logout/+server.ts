// src/routes/auth/logout/+server.ts
import type { RequestHandler } from './$types'
import { redirect } from '@sveltejs/kit'
import { destroySession, SESSION_COOKIE_NAME } from '$lib/auth'

export const POST: RequestHandler = async ({ locals, cookies, url, request }) => {
  // comment: destroy server-side session if present
  if (locals.sessionId) {
    await destroySession(locals.sessionId)
  }

  // comment: clear the browser cookie - options must match how it was originally set
  cookies.set(SESSION_COOKIE_NAME, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // comment: if your dev server is http://localhost, set secure:false during local dev
    secure: true,
    maxAge: 0 // comment: immediate expiry
  })

  // comment: allow caller to specify where to go next, else default to login
  // - supports either query string ?redirect=/ or form field <input name="redirect" />
  const qsRedirect = url.searchParams.get('redirect')
  const form = await request.formData().catch(() => null)
  const formRedirect = form?.get('redirect')?.toString()
  const next = qsRedirect || formRedirect || '/auth/login'

  // comment: 303 is the correct redirect after POST
  throw redirect(303, next)
}

// optional: if someone visits /auth/logout with GET, just bounce them away without side effects
export const GET: RequestHandler = async () => {
  throw redirect(303, '/')
}

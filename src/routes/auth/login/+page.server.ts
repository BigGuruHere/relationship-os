// PURPOSE: verify credentials and set a new session cookie
import type { Actions, PageServerLoad } from './$types'
import { fail, redirect } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { verifyPassword, createSession, sessionCookieAttributes, SESSION_COOKIE_NAME } from '$lib/auth'

export const load: PageServerLoad = async ({ locals }) => {
  // If already signed in, redirect home
  if (locals.user) throw redirect(303, '/')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData()
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')

    if (!email || !password) return fail(400, { error: 'Email and password are required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return fail(400, { error: 'Invalid email or password' })

    const ok = await verifyPassword(user.passwordHash, password)
    if (!ok) return fail(400, { error: 'Invalid email or password' })

    const { cookie, expiresAt } = await createSession(user.id)
    cookies.set(SESSION_COOKIE_NAME, cookie, sessionCookieAttributes(expiresAt))

    throw redirect(303, '/')
  }
}

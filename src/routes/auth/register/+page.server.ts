// PURPOSE: create a user and immediately sign in
import type { Actions, PageServerLoad } from './$types'
import { fail, redirect } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { hashPassword, createSession, sessionCookieAttributes, SESSION_COOKIE_NAME } from '$lib/auth'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, '/')
  return {}
}

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData()
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')

    if (!email || !password) return fail(400, { error: 'Email and password are required' })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return fail(400, { error: 'Email is already registered' })

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { email, passwordHash } })

    const { cookie, expiresAt } = await createSession(user.id)
    cookies.set(SESSION_COOKIE_NAME, cookie, sessionCookieAttributes(expiresAt))

    throw redirect(303, '/')
  }
}

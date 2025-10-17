// src/routes/auth/register/+page.server.ts
// PURPOSE: create a user and immediately sign in
// NOTES:
// - Uses env-aware cookie helper so name and flags match current environment
// - All IT code is commented and uses normal hyphens

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { hashPassword, createSession, setSessionCookie } from '$lib/auth';

export const load: PageServerLoad = async ({ locals }) => {
  // If already signed in, redirect home
  if (locals.user) throw redirect(303, '/');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    // Parse form
    const form = await request.formData();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');

    // Basic validation
    if (!email || !password) return fail(400, { error: 'Email and password are required' });

    // Ensure email is not already registered
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(400, { error: 'Email is already registered' });

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    // Create session and set env-aware cookie
    const { cookie, expiresAt } = await createSession(user.id);
    setSessionCookie(cookies, locals, cookie, expiresAt);

    // Go home
    throw redirect(303, '/');
  }
};

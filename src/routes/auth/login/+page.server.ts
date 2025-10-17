// src/routes/auth/login/+page.server.ts
// PURPOSE: verify credentials and set a new session cookie
// NOTES:
// - Uses env-aware cookie helper so name and flags match current environment
// - All IT code is commented and uses normal hyphens

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { verifyPassword, createSession, setSessionCookie } from '$lib/auth';

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

    // Look up user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(400, { error: 'Invalid email or password' });

    // Verify password
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) return fail(400, { error: 'Invalid email or password' });

    // Create session and set env-aware cookie
    const { cookie, expiresAt } = await createSession(user.id);
    setSessionCookie(cookies, locals, cookie, expiresAt);

    // Go home
    throw redirect(303, '/');
  }
};

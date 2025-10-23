// src/routes/auth/login/+page.server.ts
// PURPOSE: verify credentials and set a new session cookie
// NOTES:
// - Uses env-aware cookie helper so name and flags match current environment
// - After session creation, links any pending Leads to this user by deterministic email index
// - All IT code is commented and uses normal hyphens

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { verifyPassword, createSession, setSessionCookie } from '$lib/auth';
// IT: post auth hook that claims pending leads created via public forms
import { linkLeadsForUser } from '$lib/leads/link';

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

    // Look up user by unique email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return fail(400, { error: 'Invalid email or password' });

    // Verify password
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) return fail(400, { error: 'Invalid email or password' });

    // Create session and set env-aware cookie
    const { cookie, expiresAt } = await createSession(user.id);
    setSessionCookie(cookies, locals, cookie, expiresAt);

    // IT: post auth linking - claim and link any pending leads for this verified email
    try {
      // Most schemas keep email on the user record - fall back to the submitted email just in case
      await linkLeadsForUser(user.id, user.email || email);
    } catch (e) {
      // Never block login on lead linking - log and continue
      console.warn('linkLeadsForUser failed after password login:', e);
    }

    // Go home
    throw redirect(303, '/');
  }
};

// src/routes/auth/register/+page.server.ts
// PURPOSE: create a user and immediately sign in
// NOTES:
// - Uses env-aware cookie helper so name and flags match current environment
// - After session creation, links any pending Leads to this user by deterministic email index
// - All IT code is commented and uses normal hyphens

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { hashPassword, createSession, setSessionCookie } from '$lib/auth';
// IT: post auth hook to claim and link pending leads created via public forms
import { linkLeadsForUser } from '$lib/leads/link';
// IT: encrypted email helpers - equality lookup and write
import { findUserByEmail, setUserEmail } from '$lib/server/userEmail';
import { ensureDefaultProfile } from '$lib/server/profiles';


export const load: PageServerLoad = async ({ locals }) => {
  // If already signed in, redirect home
  if (locals.user) throw redirect(303, '/');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    // Parse form
    const form = await request.formData();
    const emailInput = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    // Basic validation
    const email = emailInput.trim().toLowerCase();
    if (!email || !password) return fail(400, { error: 'Email and password are required' });

    // Ensure email is not already registered using encrypted index lookup
    const existing = await findUserByEmail(email);
    if (existing) return fail(400, { error: 'Email is already registered' });

    // Create user without plaintext email - store password hash only
    const passwordHash = await hashPassword(password);

    // IT: create user and then set encrypted email fields
    let userId: string;
    try {
      const created = await prisma.user.create({
        data: { passwordHash },
        select: { id: true }
      });
      userId = created.id;
      await setUserEmail(userId, email); // writes email_Enc and email_Idx atomically in server code
      await ensureDefaultProfile(userId, { displayName: email.split('@')[0] });

    } catch (e: unknown) {
      // IT: handle unique constraint on email_Idx in case of race
      const msg = typeof e === 'object' && e && 'code' in e ? (e as any).code : null;
      if (msg === 'P2002') {
        return fail(400, { error: 'Email is already registered' });
      }
      throw e;
    }

    // Create session and set env-aware cookie
    const { cookie, expiresAt } = await createSession(userId);
    setSessionCookie(cookies, locals, cookie, expiresAt);

    // IT: post auth linking - claim and link any pending leads for this verified email
    try {
      await linkLeadsForUser(userId, email);
    } catch (e) {
      // Do not block registration if linking fails
      console.warn('linkLeadsForUser failed after registration:', e);
    }

    // Go home
    throw redirect(303, '/');
  }
};

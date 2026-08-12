// src/routes/auth/login/+page.server.ts
// PURPOSE: verify credentials and set a new session cookie
// SECURITY:
// - Equality lookup by deterministic HMAC email index - no plaintext email queries
// - Decrypts email on the server only when needed for lead linking
// NOTES:
// - Uses env-aware cookie helper so name and flags match current environment
// - All IT code is commented and uses normal hyphens

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { verifyPassword, createSession, setSessionCookie } from '$lib/auth';
import { linkLeadsForUser } from '$lib/leads/link';

// IT - encrypted email helpers
import { findUserByEmail, decryptUserEmail } from '$lib/server/userEmail';

export const load: PageServerLoad = async ({ locals }) => {
  // If already signed in, redirect home
  if (locals.user) throw redirect(303, '/');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    // 1 - parse form
    const form = await request.formData();
    const emailInput = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    // 2 - basic validation
    if (!emailInput || !password) {
      return fail(400, { error: 'Email and password are required' });
    }

    // 3 - lookup by encrypted email index
    const user = await findUserByEmail(emailInput);
    if (!user || !user.passwordHash) {
      return fail(400, { error: 'Invalid email or password' });
    }

    // 4 - verify password
    // IT - verifyPassword takes (password, hash)
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return fail(400, { error: 'Invalid email or password' });
    }

    // 5 - create session and set env-aware cookie
    const { cookie, expiresAt } = await createSession(user.id);
    setSessionCookie(cookies, locals, cookie, expiresAt);

    // 6 - post auth linking - decrypt server-side to pass a string email only to the linker
    try {
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email_Enc: true }
      });
      const emailPlain = decryptUserEmail(u?.email_Enc ?? null);
      if (emailPlain) {
        await linkLeadsForUser(user.id, emailPlain);
      }
    } catch (e) {
      // Never block login on lead linking - log and continue
      console.warn('linkLeadsForUser failed after password login:', e);
    }

    // 7 - done
    throw redirect(303, '/');
  }
};

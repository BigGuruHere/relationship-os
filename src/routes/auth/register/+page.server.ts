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
import { findUserByEmail, encryptedUserEmailFields } from '$lib/server/userEmail';
import { randomUUID } from 'node:crypto';


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

    // Create the account, encrypted email and required default profile atomically.
    // A failure cannot leave a registered account without its default profile.
    let userId: string;
    try {
      const created = await prisma.user.create({
        data: {
          passwordHash,
          ...encryptedUserEmailFields(email),
          person: { create: {} },
          profiles: {
            create: {
              isDefault: true,
              kind: 'business',
              label: 'My profile',
              // Keep the initial public URL unguessable and independent of the email.
              slug: `p-${randomUUID()}`,
              displayName: email.split('@')[0]
            }
          }
        },
        select: { id: true }
      });
      userId = created.id;
    } catch (e: unknown) {
      // The email index is unique, including simultaneous registration attempts.
      const code = typeof e === 'object' && e && 'code' in e ? (e as { code?: string }).code : null;
      if (code === 'P2002') return fail(400, { error: 'Email is already registered' });
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

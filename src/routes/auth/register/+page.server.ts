import { provisionNewFoundationAccount } from '$lib/server/foundation/provisioning';
import { EXCHANGE_RETURN, startExchangeAfterAuth } from '$lib/server/exchangeOnboarding';
// src/routes/auth/register/+page.server.ts
// PURPOSE: create a user and immediately sign in
// NOTES:
// - Uses env-aware cookie helper so name and flags match current environment
// - All IT code is commented and uses normal hyphens

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { hashPassword, createSession, setSessionCookie } from '$lib/auth';
import { consumePasswordSignupAttempt } from '$lib/server/loginThrottle';
import { defaultProfileData } from '$lib/server/profiles';
// IT: encrypted email helpers - equality lookup and write
import { findUserByEmail, encryptedUserEmailFields } from '$lib/server/userEmail';
import { safeAuthReturn } from '$lib/server/networkJoinReturn';
import { finishProfileAuth, profileReturnForAccount, readProfileDraft, PROFILE_ONBOARDING_RETURN } from '$lib/server/profileOnboarding';


export const load: PageServerLoad = async ({ locals, url, cookies, setHeaders }) => {
  const next = safeAuthReturn(url.searchParams.get('next'));
  // If already signed in, redirect home
  if (locals.user) throw redirect(303, profileReturnForAccount(cookies, next, locals.user.id));
  // SECURITY: Draft data stays out of URLs and shared caches; it proves no identity.
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
  return { next, draft: (next === PROFILE_ONBOARDING_RETURN || next === EXCHANGE_RETURN) ? readProfileDraft(cookies) : null };
};

export const actions: Actions = {
  default: async ({ request, cookies, locals, url, getClientAddress }) => {
    const next = safeAuthReturn(url.searchParams.get('next'));
    if (locals.user) throw redirect(303, profileReturnForAccount(cookies, next, locals.user.id));
    const draft = (next === PROFILE_ONBOARDING_RETURN || next === EXCHANGE_RETURN) ? readProfileDraft(cookies) : null;
    const form = await request.formData();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return fail(400, { error: 'Enter a valid email address' });
    }
    if (password.length < 8 || password.length > 128) {
      return fail(400, { error: 'Use a password with 8 to 128 characters' });
    }
    if (!await consumePasswordSignupAttempt(getClientAddress())) {
      return fail(429, { error: 'Too many signup attempts. Please try again in 15 minutes.' });
    }
    if (await findUserByEmail(email)) return fail(400, { error: 'Email is already registered' });

    const passwordHash = await hashPassword(password);
    // Commit credentials, private profile and Foundation roots together before issuing a session.
    let created: { id: string; profiles: { id: string }[] };
    try {
      created = await prisma.$transaction(async tx => {
        const account = await tx.user.create({
          data: {
            passwordHash,
            ...encryptedUserEmailFields(email),
            person: { create: {} },
            profiles: {
              create: defaultProfileData({ displayName: draft?.name, isPublished: false })
            }
          },
          select: { id: true, profiles: { select: { id: true } } }
        });
        await provisionNewFoundationAccount(tx, account.id);
        return account;
      });
    } catch (e: unknown) {
      // The email index also catches simultaneous registrations for the same address.
      const code = typeof e === 'object' && e && 'code' in e ? e.code : null;
      if (code === 'P2002') return fail(400, { error: 'Email is already registered' });
      return fail(503, { error: 'Could not create your account. Please try again.' });
    }

    // A credential email and a draft do not authorize a legacy Lead claim or publication.
    const { cookie, expiresAt, sessionId } = await createSession(created.id);
    setSessionCookie(cookies, locals, cookie, expiresAt);
    await startExchangeAfterAuth(cookies, url, locals, next, created.id, sessionId);
    throw redirect(303, finishProfileAuth(
      cookies, url, next === EXCHANGE_RETURN ? next : PROFILE_ONBOARDING_RETURN, created.id, created.profiles[0].id
    ));
  }
};

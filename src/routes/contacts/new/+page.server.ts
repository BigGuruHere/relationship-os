// PURPOSE: Show the create contact form and handle the POST to create a contact.
// MULTI TENANT: Requires login and always sets userId on create.
// SECURITY: Encrypt PII on the server. Do not log decrypted PII.

import { fail, redirect } from '@sveltejs/kit'; // IT: no Redirect import - SvelteKit does not export it
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';

export const load: PageServerLoad = async ({ locals }) => {
  // IT: require login before showing the form
  if (!locals.user) throw redirect(303, '/auth/login');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    // IT: require login for posting
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();

    // IT: collect and trim inputs
    const fullName = String(form.get('fullName') || '').trim();
    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const company = String(form.get('company') || '').trim(); // IT: optional company

    if (!fullName) {
      // IT: fail returns a 400 and exposes data on `form` in +page.svelte
      return fail(400, { error: 'Full name is required.' });
    }

    // IT: prepare insert data with encryption and deterministic index tokens
    const data: any = {
      userId: locals.user.id,
      fullNameEnc: encrypt(fullName, 'contact.full_name'),
      fullNameIdx: buildIndexToken(fullName)
    };

    // IT: set optional encrypted fields only when provided
    if (email) {
      data.emailEnc = encrypt(email, 'contact.email');
      data.emailIdx = buildIndexToken(email);
    }
    if (phone) {
      data.phoneEnc = encrypt(phone, 'contact.phone');
      data.phoneIdx = buildIndexToken(phone);
    }
    if (company) {
      data.companyEnc = encrypt(company, 'contact.company');
      data.companyIdx = buildIndexToken(company);
    }

    // IT: do the DB write inside try-catch, but DO NOT redirect here
    let created: { id: string } | null = null;
    try {
      created = await prisma.contact.create({
        data,
        select: { id: true }
      });
    } catch (err: any) {
      // IT: unique constraint handling for email index
      if (err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('emailIdx')) {
        return fail(409, {
          error: 'A contact with this email already exists. Try searching instead or use a different email.'
        });
      }
      // IT: generic error path
      console.error('Failed to create contact:', err);
      return fail(500, { error: 'Failed to save contact. Please try again.' });
    }

    // IT: throw the framework redirect outside the catch so it is never swallowed
    throw redirect(303, `/contacts/${created!.id}`);
  }
};

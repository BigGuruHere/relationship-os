// src/routes/contacts/new/+page.server.ts
// PURPOSE: Show the create contact form and handle the POST to create a contact.
// MULTI TENANT: Requires login and always sets userId on create.
// SECURITY: Encrypt PII on the server. Do not log decrypted PII.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';

export const load: PageServerLoad = async ({ locals }) => {
  // Require login before showing the form
  if (!locals.user) throw redirect(303, '/auth/login');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    // Require login
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();

    // Collect and trim inputs
    const fullName = String(form.get('fullName') || '').trim();
    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const company = String(form.get('company') || '').trim(); // IT: new

    if (!fullName) {
      // Return a 400 with an error message that +page.svelte shows via {form.error}
      return fail(400, { error: 'Full name is required.' });
    }

    // Prepare insert data with encryption and deterministic index tokens
    const data: any = {
      userId: locals.user.id,
      fullNameEnc: encrypt(fullName, 'contact.full_name'),
      fullNameIdx: buildIndexToken(fullName)
    };

    // Optional fields - only set when provided
    if (email) {
      data.emailEnc = encrypt(email, 'contact.email');
      data.emailIdx = buildIndexToken(email);
    }
    if (phone) {
      data.phoneEnc = encrypt(phone, 'contact.phone');
      data.phoneIdx = buildIndexToken(phone);
    }
    if (company) {
      data.companyEnc = encrypt(company, 'contact.company'); // IT: new
      data.companyIdx = buildIndexToken(company); // IT: new
    }

    // Execute insert and handle unique collisions on emailIdx if present
    try {
      const created = await prisma.contact.create({
        data,
        select: { id: true }
      });
      // On success redirect to the new contact
      throw redirect(303, `/contacts/${created.id}`);
    } catch (err: any) {
      // Unique constraint handling for email index
      if (err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('emailIdx')) {
        return fail(409, {
          error: 'A contact with this email already exists. Try searching instead or use a different email.'
        });
      }
      // Generic error
      console.error('Failed to create contact:', err);
      return fail(500, { error: 'Failed to save contact. Please try again.' });
    }
  }
};

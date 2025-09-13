// src/routes/contacts/new/+page.server.ts
// PURPOSE: Show the create contact form and handle the POST to create a contact.
// MULTI TENANT: Requires login and always sets userId on create.
// SECURITY: Do not decrypt here. Validate inputs. Do not log PII.

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
  // Default form action - creates a contact
  default: async ({ request, locals }) => {
    // Require login
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();

    // Collect and trim inputs
    const fullName = String(form.get('fullName') || '').trim();
    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim();

    if (!fullName) {
      // Return a 400 with an error message that +page.svelte shows via {form.error}
      return fail(400, { error: 'Full name is required.' });
    }

    let id = '';
    try {
      // Prepare encrypted fields and deterministic equality indexes
      const data: any = {
        userId: locals.user.id,                             // tenant ownership
        fullNameEnc: encrypt(fullName, 'contact.full_name'),// AES-GCM ciphertext
        fullNameIdx: buildIndexToken(fullName)              // HMAC index for equality search
      };

      if (email) {
        data.emailEnc = encrypt(email, 'contact.email');
        data.emailIdx = buildIndexToken(email);
      }
      if (phone) {
        data.phoneEnc = encrypt(phone, 'contact.phone');
        data.phoneIdx = buildIndexToken(phone);
      }

      // Insert the contact and capture the id for redirect
      const created = await prisma.contact.create({
        data,
        select: { id: true }
      });
      id = created.id;
    } catch (err: any) {
      // Handle unique constraint on emailIdx if enforced in schema
      if (err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('emailIdx')) {
        return fail(409, {
          error: 'A contact with this email already exists. Try searching instead or use a different email.'
        });
      }
      // Generic error
      console.error('Failed to create contact:', err);
      return fail(500, { error: 'Failed to save contact. Please try again.' });
    }

    // Redirect outside the try/catch so it is not caught as an error
    throw redirect(303, `/contacts/${id}`);
  }
};

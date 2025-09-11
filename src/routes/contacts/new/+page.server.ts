// src/routes/contacts/new/+page.server.ts
// PURPOSE: Create a contact; uses HMAC indexes + AES-GCM encryption.
// NOTE: We keep AAD simple (entity name) to bind ciphertext to context.

import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';

export const actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const fullName = String(form.get('fullName') ?? '');
    const email    = (form.get('email')  ? String(form.get('email'))  : undefined);
    const phone    = (form.get('phone')  ? String(form.get('phone'))  : undefined);

    if (!fullName.trim()) {
      return fail(400, { error: 'Full name is required' });
    }

    // Build deterministic indexes (nullable fields handled)
    const fullNameIdx = buildIndexToken(fullName);
    const emailIdx    = email ? buildIndexToken(email) : null;
    const phoneIdx    = phone ? buildIndexToken(phone) : null;

    // Encrypt fields for at-rest confidentiality
    const fullNameEnc = encrypt(fullName, 'contact.full_name');
    const emailEnc    = email ? encrypt(email, 'contact.email') : null;
    const phoneEnc    = phone ? encrypt(phone, 'contact.phone') : null;

    try {
      const contact = await prisma.contact.create({
        data: {
          fullNameEnc, fullNameIdx,
          emailEnc, emailIdx,
          phoneEnc, phoneIdx,
          tags: [],
        },
        select: { id: true }
      });

      // Option A: return success message on same page
      return { success: true, contactId: contact.id };

      // Option B: redirect straight to contact page
      // throw redirect(303, `/contacts/${contact.id}`);
    } catch (e: any) {
      return fail(500, { error: 'Failed to save contact' });
    }
  }
};

// src/routes/contacts/new/+page.server.ts
// PURPOSE: Create a contact using HMAC indexes for equality search and
//          AES-256-GCM encryption for at-rest confidentiality.
//
// WHAT THIS DOES:
// - Validates incoming form data (zod).
// - Normalizes inputs for index creation (HMAC).
// - Encrypts plaintext fields with stable AAD strings.
// - Inserts the row.
// - Handles duplicate email nicely.
//
// SECURITY NOTES:
// - Decryption is never done here. We only encrypt on write.
// - Make sure SECRET_MASTER_KEY is set in env (local and Railway).
// - Contact.tags is now a relation via ContactTag, so do not pass tags: [] here.

import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { z } from 'zod';
import { buildIndexToken, encrypt } from '$lib/crypto';

// AAD constants to avoid typos across reads and writes
const AAD = {
  FULL_NAME: 'contact.full_name',
  EMAIL: 'contact.email',
  PHONE: 'contact.phone'
} as const;

// Validation schema
// Adjust to your needs, for example stricter phone rules or required email
const CreateContactSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .max(320)
    .optional()
    .or(z.literal('')), // allow empty string which we will treat as undefined
  phone: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal('')) // allow empty string which we will treat as undefined
});

export const actions = {
  default: async ({ request }) => {
    // 1) Parse and validate the form
    const form = await request.formData();
    const parsed = CreateContactSchema.safeParse({
      fullName: form.get('fullName'),
      email: form.get('email'),
      phone: form.get('phone')
    });

    if (!parsed.success) {
      // Return a friendly error back to the form
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }

    // 2) Normalize optional fields: empty string to undefined
    const fullName = parsed.data.fullName;
    const email = parsed.data.email ? String(parsed.data.email) : undefined;
    const phone = parsed.data.phone ? String(parsed.data.phone) : undefined;

    // 3) Build deterministic HMAC indexes for equality queries
    //    Normalization rules live inside buildIndexToken
    const fullNameIdx = buildIndexToken(fullName);
    const emailIdx = email ? buildIndexToken(email) : null;
    const phoneIdx = phone ? buildIndexToken(phone) : null;

    // 4) Encrypt plaintexts with stable AADs so we can decrypt later
    const fullNameEnc = encrypt(fullName, AAD.FULL_NAME);
    const emailEnc = email ? encrypt(email, AAD.EMAIL) : null;
    const phoneEnc = phone ? encrypt(phone, AAD.PHONE) : null;

    // 5) Insert into DB
    // IMPORTANT: Contact.tags is now a relation via ContactTag
    // Do not pass tags: [] here. Use nested writes if you want to attach tags at create time.
    try {
      const created = await prisma.contact.create({
        data: {
          fullNameEnc,
          fullNameIdx,
          emailEnc,
          emailIdx,
          phoneEnc,
          phoneIdx
        },
        select: { id: true }
      });

      // Happy path - inform the page so it can link to the contact
      return { success: true, contactId: created.id };
    } catch (err: any) {
      // Prisma unique constraint error code
      if (err?.code === 'P2002' && err?.meta?.target?.includes('emailIdx')) {
        return fail(409, {
          error:
            'A contact with this email already exists. Try searching instead or use a different email.'
        });
      }

      // Generic error
      console.error('Failed to create contact:', err);
      return fail(500, { error: 'Failed to save contact. Please try again.' });
    }
  }
};

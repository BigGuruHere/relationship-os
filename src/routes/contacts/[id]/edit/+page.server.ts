// src/routes/contacts/[id]/edit/+page.server.ts
// PURPOSE: Load a single contact for editing and handle POST updates.
// MULTI TENANT: All reads and writes are scoped by userId.
// SECURITY: Decrypt only on the server. All IT code is commented and uses hyphens only.

import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt, encrypt, buildIndexToken } from '$lib/crypto';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // Read the contact scoped by user
  const row = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, companyEnc: true }
  });
  if (!row) throw redirect(303, '/contacts');

  // Decrypt on the server - never in the browser
  let fullName = '';
  let email: string | null = null;
  let phone: string | null = null;
  let company: string | null = null;
  try { fullName = decrypt(row.fullNameEnc, 'contact.full_name'); } catch {}
  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null; } catch {}
  try { company = row.companyEnc ? decrypt(row.companyEnc, 'contact.company') : null; } catch {}

  // Return simple plain data to prefill the form
  return {
    contact: {
      id: row.id,
      fullName,
      email: email || '',
      phone: phone || '',
      company: company || ''
    }
  };
};

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    // Require login
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const fullName = String(form.get('fullName') || '').trim();
    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const company = String(form.get('company') || '').trim();

    if (!fullName) {
      return fail(400, { error: 'Full name is required.' });
    }

    // Build update payload - only set fields that have a value, set null for optional blanks
    const data: any = {
      fullNameEnc: encrypt(fullName, 'contact.full_name'),
      fullNameIdx: buildIndexToken(fullName)
    };
    data.emailEnc = email ? encrypt(email, 'contact.email') : null;
    data.emailIdx = email ? buildIndexToken(email) : null;
    data.phoneEnc = phone ? encrypt(phone, 'contact.phone') : null;
    data.phoneIdx = phone ? buildIndexToken(phone) : null;
    data.companyEnc = company ? encrypt(company, 'contact.company') : null;
    data.companyIdx = company ? buildIndexToken(company) : null;

    try {
      const res = await prisma.contact.updateMany({
        where: { id: params.id, userId: locals.user.id },
        data
      });
      if (!res.count) {
        return fail(404, { error: 'Contact not found for this user' });
      }
    } catch (err: any) {
      // Handle unique email collisions gracefully
      if (err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('emailIdx')) {
        return fail(409, { error: 'Another contact already has this email.' });
      }
      console.error('[contacts:edit] update failed', err);
      return fail(500, { error: 'Failed to save changes. Please try again.' });
    }

    // On success, redirect back to the contact view
    throw redirect(303, `/contacts/${params.id}`);
  }
};

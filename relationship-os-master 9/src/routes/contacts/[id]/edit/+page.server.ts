// src/routes/contacts/[id]/edit/+page.server.ts
// PURPOSE: Load a single contact for editing and handle POST updates.
// MULTI TENANT: All reads and writes are scoped by userId.
// SECURITY: Decrypt only on the server. All IT code is commented.

import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt, encrypt, buildIndexToken } from '$lib/crypto';

// IT: normalize a LinkedIn url for stable equality tokens.
function normalizeLinkedin(input: string) {
  try {
    const u = new URL(input.trim().replace(/^http:\/\//i, 'https://'));
    if (u.hostname.endsWith('linkedin.com')) {
      u.hash = '';
      u.search = '';
    }
    return u.toString();
  } catch {
    return input.trim();
  }
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      companyEnc: true,
      positionEnc: true,
      linkedinEnc: true
    }
  });
  if (!row) throw redirect(303, '/contacts');

  let fullName = '';
  let email = '';
  let phone = '';
  let company = '';
  let position = '';
  let linkedin = '';
  try { fullName = decrypt(row.fullNameEnc, 'contact.full_name'); } catch {}
  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : ''; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : ''; } catch {}
  try { company = row.companyEnc ? decrypt(row.companyEnc, 'contact.company') : ''; } catch {}
  try { position = row.positionEnc ? decrypt(row.positionEnc, 'contact.position') : ''; } catch {}
  try { linkedin = row.linkedinEnc ? decrypt(row.linkedinEnc, 'contact.linkedin') : ''; } catch {}

  return {
    contact: {
      id: row.id,
      fullName,
      email,
      phone,
      company,
      position,
      linkedin
    }
  };
};

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const fullName = String(form.get('fullName') || '').trim();
    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const company = String(form.get('company') || '').trim();
    const position = String(form.get('position') || '').trim();
    const linkedinRaw = String(form.get('linkedin') || '').trim();
    const linkedin = linkedinRaw ? normalizeLinkedin(linkedinRaw) : '';

    if (!fullName) {
      return fail(400, { error: 'Full name is required.' });
    }

    const data: any = {
      fullNameEnc: encrypt(fullName, 'contact.full_name'),
      fullNameIdx: buildIndexToken(fullName),
      emailEnc: email ? encrypt(email, 'contact.email') : null,
      emailIdx: email ? buildIndexToken(email) : null,
      phoneEnc: phone ? encrypt(phone, 'contact.phone') : null,
      phoneIdx: phone ? buildIndexToken(phone) : null,
      companyEnc: company ? encrypt(company, 'contact.company') : null,
      companyIdx: company ? buildIndexToken(company) : null,
      positionEnc: position ? encrypt(position, 'contact.position') : null,
      positionIdx: position ? buildIndexToken(position) : null,
      linkedinEnc: linkedin ? encrypt(linkedin, 'contact.linkedin') : null,
      linkedinIdx: linkedin ? buildIndexToken(linkedin) : null
    };

    try {
      const res = await prisma.contact.updateMany({ where: { id: params.id, userId: locals.user.id }, data });
      if (!res.count) return fail(404, { error: 'Contact not found for this user' });
    } catch (err: any) {
      if (err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('emailIdx')) {
        return fail(409, { error: 'Another contact already has this email.' });
      }
      console.error('[contacts:edit] update failed', err);
      return fail(500, { error: 'Failed to save changes. Please try again.' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  }
};

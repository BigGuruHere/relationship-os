// src/routes/contacts/new/+page.server.ts
// PURPOSE: create a contact with optional Position and LinkedIn
// SECURITY: tenant scoped by locals.user.id - encrypt PII server side - deterministic HMAC for equality search

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';

// IT: normalize a LinkedIn url for stable equality tokens
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

export const load: PageServerLoad = async ({ locals }) => {
  // IT: require login
  if (!locals.user) throw redirect(303, '/auth/login');
  return {};
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    // IT: require login
    if (!locals.user) throw redirect(303, '/auth/login');

    const fd = await request.formData();

    // IT: collect inputs
    const fullName = String(fd.get('fullName') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    const company = String(fd.get('company') || '').trim();
    const position = String(fd.get('position') || '').trim();
    const linkedinRaw = String(fd.get('linkedin') || '').trim();
    const linkedin = linkedinRaw ? normalizeLinkedin(linkedinRaw) : '';

    // IT: preserve values for repopulation on error
    const values = { fullName, email, phone, company, position, linkedin };

    if (!fullName) {
      return fail(400, { error: 'Name is required', values });
    }

    // IT: build encrypted payload
    const data: any = {
      userId: locals.user.id,
      fullNameEnc: encrypt(fullName, 'contact.full_name'),
      fullNameIdx: buildIndexToken(fullName)
    };

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
    if (position) {
      data.positionEnc = encrypt(position, 'contact.position');
      // data.positionIdx = buildIndexToken(position); // optional
    }
    if (linkedin) {
      data.linkedinEnc = encrypt(linkedin, 'contact.linkedin');
      data.linkedinIdx = buildIndexToken(linkedin);
    }

    // IT: create contact and capture the id
    let createdId: string;
    try {
      const created = await prisma.contact.create({ data, select: { id: true } });
      createdId = created.id;
    } catch (e: any) {
      // IT: handle uniqueness gracefully if you added a unique on linkedin
      if (e?.code === 'P2002') {
        return fail(409, { error: 'A contact already uses this LinkedIn url', values });
      }
      console.error('contact create failed:', e);
      return fail(500, { error: 'Could not create contact', values });
    }

    // IT: redirect AFTER the try so it is not caught and logged as an error
    throw redirect(303, `/contacts/${createdId}`);
  }
};

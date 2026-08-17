// src/routes/contacts/new/+page.server.ts
// PURPOSE: create a contact with optional Position and LinkedIn
// SECURITY: tenant scoped by locals.user.id - encrypt PII server side - deterministic HMAC for equality search

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, decrypt, buildIndexToken } from '$lib/crypto';

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

function safeDecrypt(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}

function uniqById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function contactDuplicateSummary(row: any, matchReasons: string[]) {
  return {
    id: row.id,
    label: safeDecrypt(row.fullNameEnc, 'contact.full_name', 'Untitled contact'),
    company: safeDecrypt(row.companyEnc, 'contact.company', ''),
    email: safeDecrypt(row.emailEnc, 'contact.email', ''),
    phone: safeDecrypt(row.phoneEnc, 'contact.phone', ''),
    position: safeDecrypt(row.positionEnc, 'contact.position', ''),
    href: `/contacts/${row.id}`,
    matchReasons
  };
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
    const forceCreate = String(fd.get('forceCreate') || '') === '1';

    // IT: preserve values for repopulation on error or duplicate review
    const values = { fullName, email, phone, company, position, linkedin };

    if (!fullName) {
      return fail(400, { error: 'Name is required', values });
    }

    const selectDuplicateFields = {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      companyEnc: true,
      positionEnc: true
    } as const;

    const [sameNameRows, samePhoneRows, sameEmailRows] = await Promise.all([
      prisma.contact.findMany({ where: { userId: locals.user.id, fullNameIdx: buildIndexToken(fullName) }, select: selectDuplicateFields, take: 6, orderBy: { updatedAt: 'desc' } }),
      phone ? prisma.contact.findMany({ where: { userId: locals.user.id, phoneIdx: buildIndexToken(phone) }, select: selectDuplicateFields, take: 6, orderBy: { updatedAt: 'desc' } }) : Promise.resolve([]),
      email ? prisma.contact.findMany({ where: { userId: locals.user.id, emailIdx: buildIndexToken(email) }, select: selectDuplicateFields, take: 6, orderBy: { updatedAt: 'desc' } }) : Promise.resolve([])
    ]);

    const matchReasonsById = new Map<string, Set<string>>();
    for (const row of sameNameRows) matchReasonsById.set(row.id, new Set([...(matchReasonsById.get(row.id) || []), 'same name']));
    for (const row of samePhoneRows) matchReasonsById.set(row.id, new Set([...(matchReasonsById.get(row.id) || []), 'same phone']));
    for (const row of sameEmailRows) matchReasonsById.set(row.id, new Set([...(matchReasonsById.get(row.id) || []), 'same email']));

    const duplicateRows = uniqById([...sameNameRows, ...samePhoneRows, ...sameEmailRows]);
    if (!forceCreate && duplicateRows.length > 0) {
      return fail(409, {
        values,
        duplicateWarning: {
          title: 'Possible duplicate contact found',
          message: 'Review the existing contact before creating a new one. Same names are allowed, but this helps avoid accidental duplicates.',
          matches: duplicateRows.map((row) => contactDuplicateSummary(row, Array.from(matchReasonsById.get(row.id) || []))),
          allowCreateAnyway: true
        }
      });
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
      if (e?.code === 'P2002') {
        return fail(409, { error: 'A contact already uses one of these unique details.', values });
      }
      console.error('contact create failed:', e);
      return fail(500, { error: 'Could not create contact', values });
    }

    // IT: redirect AFTER the try so it is not caught and logged as an error
    throw redirect(303, `/contacts/${createdId}`);
  }
};

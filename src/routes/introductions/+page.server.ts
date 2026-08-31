// src/routes/introductions/+page.server.ts
// PURPOSE: Manual Stage 8.2 Introduction capture before automated matching exists.
// SECURITY: Every query/write is scoped to the signed-in Relish workspace.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { safeDecrypt } from '$lib/deals';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { createIntroductionFromForm, loadIntroductions } from '$lib/server/introductions';
import { INTRODUCTION_STATUSES } from '$lib/introductions';
import { KNOWLEDGE_AUTHORITIES, KNOWLEDGE_SOURCE_TYPES } from '$lib/provenance';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const [introductions, contactsRaw, companiesRaw] = await Promise.all([
    loadIntroductions(userId),
    prisma.contact.findMany({
      where: { userId },
      select: { id: true, fullNameEnc: true, linkedUserId: true },
      orderBy: { updatedAt: 'desc' },
      take: 500
    }),
    prisma.company.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, nameEnc: true },
      orderBy: { updatedAt: 'desc' },
      take: 500
    })
  ]);

  return {
    introductions,
    contacts: await Promise.all(contactsRaw.map(async (contact: any) => ({ id: contact.id, name: await contactDisplayName(contact) }))),
    companies: companiesRaw.map((company: any) => ({ id: company.id, name: safeDecrypt(company.nameEnc, 'company.name', 'Untitled company') })),
    introductionStatuses: INTRODUCTION_STATUSES,
    knowledgeAuthorities: KNOWLEDGE_AUTHORITIES,
    knowledgeSourceTypes: KNOWLEDGE_SOURCE_TYPES
  };
};

export const actions: Actions = {
  create: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const introduction = await createIntroductionFromForm(locals.user.id, await request.formData());
      throw redirect(303, `/introductions/${introduction.id}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not create introduction.' });
    }
  }
};

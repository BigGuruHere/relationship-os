// src/routes/deals/new/+page.server.ts
// PURPOSE: Create a relationship-driven deal with an optional first contact link.
// SECURITY: Tenant scoped by locals.user.id and encrypted fields are written server side.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { contactOptionsForRows } from '$lib/server/contactDisplay';
import {
  DEAL_RELATIONSHIP_TYPES,
  DEAL_STATUSES,
  defaultProbabilityForStatus,
  normaliseDealRelationshipType,
  normaliseDealStatus,
  parseMoneyToCents,
  parseOptionalDate,
  parseProbability
} from '$lib/deals';

async function loadContactOptions(userId: string) {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: { id: true, fullNameEnc: true, linkedUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 300
  });
  return contactOptionsForRows(contacts);
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  return {
    statusOptions: DEAL_STATUSES,
    relationshipOptions: DEAL_RELATIONSHIP_TYPES,
    contactOptions: await loadContactOptions(locals.user.id)
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '').trim();
    const currency = String(form.get('currency') || 'AUD').trim().toUpperCase().slice(0, 3) || 'AUD';
    const status = normaliseDealStatus(form.get('status'));
    const probability = parseProbability(form.get('probability')) ?? defaultProbabilityForStatus(status);
    const valueCents = parseMoneyToCents(form.get('value'));
    const expectedCloseDate = parseOptionalDate(form.get('expectedCloseDate'));
    const firstContactId = String(form.get('firstContactId') || '').trim();
    const relationshipType = normaliseDealRelationshipType(form.get('relationshipType'));
    const label = String(form.get('label') || '').trim() || null;

    const values = {
      title,
      description,
      currency,
      status,
      probability,
      value: String(form.get('value') || '').trim(),
      expectedCloseDate: String(form.get('expectedCloseDate') || '').trim(),
      firstContactId,
      relationshipType: relationshipType || '',
      label: label || ''
    };

    if (!title) {
      return fail(400, { error: 'Deal title is required.', values });
    }

    if (firstContactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: firstContactId, userId: locals.user.id },
        select: { id: true }
      });
      if (!contact) return fail(404, { error: 'Selected contact was not found.', values });
    }

    let dealId = '';
    try {
      const created = await prisma.deal.create({
        data: {
          userId: locals.user.id,
          titleEnc: encrypt(title, 'deal.title'),
          titleIdx: buildIndexToken(title),
          descriptionEnc: description ? encrypt(description, 'deal.description') : null,
          currency,
          status: status as any,
          probability,
          valueCents,
          expectedCloseDate,
          closedAt: status === 'WON' || status === 'LOST' ? new Date() : null,
          contacts: firstContactId
            ? {
                create: {
                  userId: locals.user.id,
                  contactId: firstContactId,
                  relationshipType: relationshipType as any,
                  label: label || (relationshipType ? null : 'connected'),
                  isPrimary: true
                }
              }
            : undefined
        },
        select: { id: true }
      });
      dealId = created.id;
    } catch (err: any) {
      console.error('[deals:new] create failed', { message: err?.message, code: err?.code });
      return fail(500, { error: 'Could not create deal.', values });
    }

    throw redirect(303, `/deals/${dealId}`);
  }
};

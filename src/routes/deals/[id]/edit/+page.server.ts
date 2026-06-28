// src/routes/deals/[id]/edit/+page.server.ts
// PURPOSE: Edit deal core details.
// SECURITY: All reads and writes are tenant scoped and encrypted fields stay server side.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import {
  DEAL_STATUSES,
  centsToInputValue,
  dateToInputValue,
  normaliseDealStatus,
  parseMoneyToCents,
  parseOptionalDate,
  parseProbability,
  safeDecrypt
} from '$lib/deals';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await prisma.deal.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      valueCents: true,
      currency: true,
      status: true,
      probability: true,
      expectedCloseDate: true,
      lostReasonEnc: true
    }
  });

  if (!row) throw redirect(303, '/deals');

  return {
    statusOptions: DEAL_STATUSES,
    deal: {
      id: row.id,
      title: safeDecrypt(row.titleEnc, 'deal.title', ''),
      description: safeDecrypt(row.descriptionEnc, 'deal.description', ''),
      value: centsToInputValue(row.valueCents),
      currency: row.currency,
      status: row.status,
      probability: row.probability,
      expectedCloseDate: dateToInputValue(row.expectedCloseDate),
      lostReason: safeDecrypt(row.lostReasonEnc, 'deal.lost_reason', '')
    }
  };
};

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '').trim();
    const currency = String(form.get('currency') || 'AUD').trim().toUpperCase().slice(0, 3) || 'AUD';
    const status = normaliseDealStatus(form.get('status'));
    const probability = parseProbability(form.get('probability'));
    const valueCents = parseMoneyToCents(form.get('value'));
    const expectedCloseDate = parseOptionalDate(form.get('expectedCloseDate'));
    const lostReason = String(form.get('lostReason') || '').trim();

    if (!title) return fail(400, { error: 'Deal title is required.' });

    try {
      const res = await prisma.deal.updateMany({
        where: { id: params.id, userId: locals.user.id },
        data: {
          titleEnc: encrypt(title, 'deal.title'),
          titleIdx: buildIndexToken(title),
          descriptionEnc: description ? encrypt(description, 'deal.description') : null,
          valueCents,
          currency,
          status: status as any,
          probability,
          expectedCloseDate,
          closedAt: status === 'WON' || status === 'LOST' ? new Date() : null,
          lostReasonEnc: status === 'LOST' && lostReason ? encrypt(lostReason, 'deal.lost_reason') : null
        }
      });

      if (!res.count) return fail(404, { error: 'Deal not found.' });
    } catch (err) {
      console.error('[deals:edit] failed', err);
      return fail(500, { error: 'Could not save deal.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  }
};

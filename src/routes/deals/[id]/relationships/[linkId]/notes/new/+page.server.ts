// src/routes/deals/[id]/relationships/[linkId]/notes/new/+page.server.ts
// PURPOSE: Create a text or voice note for a specific deal-contact commercial thread.
// SECURITY: Requires login and scopes deal/link writes by userId.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { safeDecrypt } from '$lib/deals';

const NewThreadNote = z.object({
  channel: z.string().min(1).default('note'),
  occurredAt: z.string().optional(),
  text: z.string().min(1, 'Note cannot be empty'),
  summary: z.string().optional()
});

async function loadOwnedLink(userId: string, dealId: string, linkId: string) {
  return prisma.dealContact.findFirst({
    where: { id: linkId, dealId, userId },
    select: {
      id: true,
      dealId: true,
      contactId: true,
      deal: { select: { id: true, titleEnc: true } },
      contact: { select: { id: true, fullNameEnc: true, companyEnc: true, linkedUserId: true } }
    }
  });
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const link = await loadOwnedLink(locals.user.id, params.id, params.linkId);
  if (!link) throw redirect(303, `/deals/${params.id}`);

  return {
    thread: {
      id: link.id,
      dealId: link.dealId,
      dealTitle: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
      contactId: link.contactId,
      contactName: await contactDisplayName(link.contact),
      company: safeDecrypt(link.contact.companyEnc, 'contact.company', '')
    }
  };
};

export const actions: Actions = {
  save: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const parsed = NewThreadNote.safeParse({
      channel: form.get('channel') || 'note',
      occurredAt: form.get('occurredAt') || undefined,
      text: form.get('text'),
      summary: form.get('summary') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message || 'Invalid input',
        draft: {
          channel: String(form.get('channel') || 'note'),
          occurredAt: String(form.get('occurredAt') || ''),
          text: String(form.get('text') || ''),
          summary: String(form.get('summary') || '')
        }
      });
    }

    const link = await loadOwnedLink(userId, params.id, params.linkId);
    if (!link) return fail(404, { error: 'Deal relationship not found.' });

    let occurredAt: Date | undefined;
    if (parsed.data.occurredAt) {
      const d = new Date(parsed.data.occurredAt);
      if (!Number.isNaN(d.getTime())) occurredAt = d;
    }

    try {
      await prisma.dealContactNote.create({
        data: {
          userId,
          dealContactId: link.id,
          dealId: link.dealId,
          contactId: link.contactId,
          channel: parsed.data.channel,
          occurredAt: occurredAt ?? new Date(),
          rawTextEnc: encrypt(parsed.data.text, 'deal_contact_note.raw_text'),
          summaryEnc: parsed.data.summary?.trim() ? encrypt(parsed.data.summary.trim(), 'deal_contact_note.summary') : null
        }
      });
    } catch (err) {
      console.error('[deal-thread:notes:new] failed', err);
      return fail(500, { error: 'Could not save thread note.' });
    }

    throw redirect(303, `/deals/${params.id}/relationships/${params.linkId}`);
  }
};

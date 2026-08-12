// src/routes/deals/[id]/notes/new/+page.server.ts
// PURPOSE: Create a text or voice note against a deal, with optional AI summary.
// SECURITY: Requires login and scopes deal, contact, and note writes by userId.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { safeDecrypt } from '$lib/deals';

// IT: validate the fields posted from the deal note form.
const NewDealNote = z.object({
  channel: z.string().min(1).default('note'),
  occurredAt: z.string().optional(),
  contactId: z.string().optional(),
  text: z.string().min(1, 'Note cannot be empty'),
  summary: z.string().optional()
});

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await prisma.deal.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: {
      id: true,
      titleEnc: true,
      contacts: {
        select: {
          contact: {
            select: {
              id: true,
              fullNameEnc: true,
              companyEnc: true,
              linkedUserId: true
            }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    }
  });

  if (!row) throw redirect(303, '/deals');

  const people = await Promise.all(
    row.contacts.map(async (link: any) => ({
      id: link.contact.id,
      name: await contactDisplayName(link.contact),
      company: safeDecrypt(link.contact.companyEnc, 'contact.company', '')
    }))
  );

  return {
    deal: {
      id: row.id,
      title: safeDecrypt(row.titleEnc, 'deal.title', 'Untitled deal')
    },
    people
  };
};

export const actions: Actions = {
  save: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const parsed = NewDealNote.safeParse({
      channel: form.get('channel') || 'note',
      occurredAt: form.get('occurredAt') || undefined,
      contactId: form.get('contactId') || undefined,
      text: form.get('text'),
      summary: form.get('summary') || undefined
    });

    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message || 'Invalid input',
        draft: {
          channel: String(form.get('channel') || 'note'),
          occurredAt: String(form.get('occurredAt') || ''),
          contactId: String(form.get('contactId') || ''),
          text: String(form.get('text') || ''),
          summary: String(form.get('summary') || '')
        }
      });
    }

    const userId = locals.user.id;
    const dealId = params.id;
    const contactId = String(parsed.data.contactId || '').trim() || null;

    const deal = await prisma.deal.findFirst({
      where: { id: dealId, userId },
      select: { id: true }
    });
    if (!deal) return fail(404, { error: 'Deal not found.' });

    if (contactId) {
      // IT: only allow linking a person who is already attached to this deal.
      const link = await prisma.dealContact.findFirst({
        where: { userId, dealId, contactId },
        select: { id: true }
      });
      if (!link) return fail(400, { error: 'That person is not attached to this deal.' });
    }

    let occurredAt: Date | undefined;
    if (parsed.data.occurredAt) {
      const d = new Date(parsed.data.occurredAt);
      if (!Number.isNaN(d.getTime())) occurredAt = d;
    }

    try {
      await prisma.dealNote.create({
        data: {
          userId,
          dealId,
          contactId,
          channel: parsed.data.channel,
          occurredAt: occurredAt ?? new Date(),
          rawTextEnc: encrypt(parsed.data.text, 'deal_note.raw_text'),
          summaryEnc: parsed.data.summary?.trim()
            ? encrypt(parsed.data.summary.trim(), 'deal_note.summary')
            : null
        }
      });
    } catch (err) {
      console.error('[deals:notes:new] save failed', err);
      return fail(500, { error: 'Could not save deal note.' });
    }

    throw redirect(303, `/deals/${dealId}`);
  }
};

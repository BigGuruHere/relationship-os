// src/routes/deals/[id]/notes/[noteId]/+page.server.ts
// PURPOSE: Show and delete a single deal note.
// SECURITY: Requires login and tenant scopes all reads and deletes by userId.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { safeDecrypt } from '$lib/deals';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const note = await prisma.dealNote.findFirst({
    where: { id: params.noteId, dealId: params.id, userId: locals.user.id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      summaryEnc: true,
      createdAt: true,
      deal: { select: { id: true, titleEnc: true } },
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
    }
  });

  if (!note) throw redirect(303, `/deals/${params.id}`);

  return {
    note: {
      id: note.id,
      channel: note.channel,
      occurredAt: note.occurredAt,
      text: safeDecrypt(note.rawTextEnc, 'deal_note.raw_text', ''),
      summary: safeDecrypt(note.summaryEnc, 'deal_note.summary', ''),
      createdAt: note.createdAt,
      dealId: note.deal.id,
      dealTitle: safeDecrypt(note.deal.titleEnc, 'deal.title', 'Untitled deal'),
      contactId: note.contact?.id || null,
      contactName: note.contact ? await contactDisplayName(note.contact) : ''
    }
  };
};

export const actions: Actions = {
  delete: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    try {
      await prisma.dealNote.deleteMany({
        where: { id: params.noteId, dealId: params.id, userId: locals.user.id }
      });
    } catch (err) {
      console.error('[deals:notes:delete] failed', err);
      return fail(500, { error: 'Could not delete deal note.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  }
};

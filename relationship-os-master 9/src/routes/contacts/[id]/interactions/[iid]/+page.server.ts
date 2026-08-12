// src/routes/contacts/[id]/interactions/[iid]/+page.server.ts
import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// load unchanged except we no longer select tags
export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await prisma.interaction.findFirst({
    where: { id: params.iid, userId: locals.user.id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      summaryEnc: true,
      contactId: true,
      contact: { select: { fullNameEnc: true } }
    }
  });
  if (!row) throw error(404, 'Interaction not found');

  let contactName = '(name unavailable)';
  try { contactName = decrypt(row.contact.fullNameEnc, 'contact.full_name'); } catch {}

  let text = '';
  try { text = row.rawTextEnc ? decrypt(row.rawTextEnc, 'interaction.raw_text') : ''; } catch {}

  let summary = '';
  try { summary = row.summaryEnc ? decrypt(row.summaryEnc, 'interaction.raw_text') : ''; } catch {}

  return {
    interaction: {
      id: row.id,
      channel: row.channel,
      occurredAt: row.occurredAt,
      text,
      summary,
      contactId: row.contactId,
      contactName
    }
  };
};

export const actions: Actions = {
  editSummary: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const value = String(form.get('summary') ?? '').trim();

    // update summary - encrypt server side - store empty as NULL
    try {
      await prisma.interaction.updateMany({
        where: { id: params.iid, userId: locals.user.id },
        data: { summaryEnc: value ? encrypt(value, 'interaction.raw_text') : null }
      });
    } catch (e) {
      console.error('[interaction:editSummary] failed', e);
      return fail(500, { error: 'Failed to save summary' });
    }

    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  editText: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const value = String(form.get('text') ?? '').trim();

    // update raw text - encrypt server side
    try {
      await prisma.interaction.updateMany({
        where: { id: params.iid, userId: locals.user.id },
        data: { rawTextEnc: value ? encrypt(value, 'interaction.raw_text') : encrypt('', 'interaction.raw_text') }
      });
    } catch (e) {
      console.error('[interaction:editText] failed', e);
      return fail(500, { error: 'Failed to save note' });
    }

    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  }
};

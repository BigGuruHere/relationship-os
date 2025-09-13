// src/routes/contacts/[id]/interactions/[iid]/edit/+page.server.ts
// PURPOSE: Edit an interaction note. Loads current values then updates after re-encrypting.
// MULTI TENANT: Requires login and scopes all queries by userId.

import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt, decrypt } from '$lib/crypto';
import { z } from 'zod';

const EditSchema = z.object({
  channel: z.string().min(1),
  occurredAt: z.string().optional(), // datetime-local string
  text: z.string().min(1, 'Note cannot be empty')
});

export const load = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await prisma.interaction.findFirst({
    where: { id: params.iid, contactId: params.id, userId: locals.user.id },
    select: { id: true, contactId: true, channel: true, occurredAt: true, rawTextEnc: true }
  });
  if (!row) return { notFound: true };

  let text = '';
  try {
    text = row.rawTextEnc ? decrypt(row.rawTextEnc, 'interaction.raw_text') : '';
  } catch {}

  return {
    interaction: {
      id: row.id,
      contactId: row.contactId,
      channel: row.channel,
      occurredAt: row.occurredAt,
      text
    }
  };
};

export const actions = {
  save: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const raw = Object.fromEntries(await request.formData());
    const parsed = EditSchema.safeParse({
      channel: String(raw.channel || ''),
      occurredAt: String(raw.occurredAt || ''),
      text: String(raw.text || '')
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.errors[0]?.message || 'Invalid input' });
    }

    const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null;
    const rawTextEnc = encrypt(parsed.data.text, 'interaction.raw_text');

    try {
      // Only update rows in this tenant and for this contact
      const res = await prisma.interaction.updateMany({
        where: { id: params.iid, contactId: params.id, userId: locals.user.id },
        data: {
          channel: parsed.data.channel,
          ...(occurredAt ? { occurredAt } : { occurredAt: null }),
          rawTextEnc
        }
      });
      if (res.count === 0) return fail(404, { error: 'Interaction not found.' });
    } catch (err) {
      console.error('Failed to update interaction:', err);
      return fail(500, { error: 'Failed to update note. Please try again.' });
    }

    // Redirect outside the try/catch
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  }
};

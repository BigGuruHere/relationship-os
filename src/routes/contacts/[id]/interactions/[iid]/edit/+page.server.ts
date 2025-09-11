// src/routes/contacts/[id]/interactions/[iid]/edit/+page.server.ts
// PURPOSE: Edit an interaction (note). Loads current values, then updates
//          after re-encrypting the body with the same AAD.

import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt, decrypt } from '$lib/crypto';
import { z } from 'zod';

const EditSchema = z.object({
  channel: z.string().min(1),
  occurredAt: z.string().optional(), // datetime-local string
  text: z.string().min(1, 'Note cannot be empty')
});

export const load = async ({ params }) => {
  const row = await prisma.interaction.findFirst({
    where: { id: params.iid, contactId: params.id },
    select: { id: true, contactId: true, occurredAt: true, channel: true, rawTextEnc: true }
  });
  if (!row) return { notFound: true };

  let text = '';
  try {
    text = decrypt(row.rawTextEnc, 'interaction.raw_text'); // same AAD as write
  } catch {
    text = '';
  }

  // Prefill fields for the form
  return {
    interaction: {
      id: row.id,
      contactId: row.contactId,
      occurredAt: row.occurredAt.toISOString(), // convert to ISO for input
      channel: row.channel,
      text
    }
  };
};

export const actions = {
  default: async ({ request, params }) => {
    const form = await request.formData();
    const parsed = EditSchema.safeParse({
      channel: form.get('channel'),
      occurredAt: form.get('occurredAt') || undefined,
      text: form.get('text')
    });

    if (!parsed.success) {
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }

    // Parse occurredAt string to Date, fallback to existing timestamp if missing
    const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined;

    // Re-encrypt updated text with same AAD
    const rawTextEnc = encrypt(parsed.data.text, 'interaction.raw_text');

    try {
      // Update by both ids to ensure ownership
      await prisma.interaction.update({
        where: { id: params.iid },
        data: {
          channel: parsed.data.channel,
          ...(occurredAt ? { occurredAt } : {}),
          rawTextEnc
        }
      });
    } catch (err) {
      console.error('Failed to update interaction:', err);
      return fail(500, { error: 'Failed to update note. Please try again.' });
    }

    // Back to the interaction view (or the contact page—your call)
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  }
};

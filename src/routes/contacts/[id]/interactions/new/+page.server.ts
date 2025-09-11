// src/routes/contacts/[id]/interactions/new/+page.server.ts
// PURPOSE: Provide two actions:
// - 'draft': echoes back the text so user can edit before saving.
// - 'save' : encrypts & persists the note as an Interaction.

import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { z } from 'zod';

const DraftSchema = z.object({
  text: z.string().min(1, 'Please type something'),
  occurredAt: z.string().optional(), // ISO string; optional for quick entry
  channel: z.string().default('note')
});

export const actions = {
  draft: async ({ request }) => {
    const form = await request.formData();
    const parsed = DraftSchema.safeParse({
      text: form.get('text'),
      occurredAt: form.get('occurredAt'),
      channel: form.get('channel') ?? 'note'
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }
    // Return data to page without saving
    return { mode: 'draft', draft: parsed.data };
  },

  save: async ({ request, params }) => {
    const form = await request.formData();
    const parsed = DraftSchema.safeParse({
      text: form.get('text'),
      occurredAt: form.get('occurredAt'),
      channel: form.get('channel') ?? 'note'
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }

    const occurredAt = parsed.data.occurredAt
      ? new Date(parsed.data.occurredAt)
      : new Date();

    // Encrypt note body at rest
    const rawTextEnc = encrypt(parsed.data.text, 'interaction.raw_text');

    try {
      await prisma.interaction.create({
        data: {
          contactId: params.id,
          occurredAt,
          channel: parsed.data.channel,
          rawTextEnc
        }
      });
      // After save, go back to the contact page
      throw redirect(303, `/contacts/${params.id}`);
    } catch (e: any) {
      return fail(500, { error: 'Failed to save note' });
    }
  }
};

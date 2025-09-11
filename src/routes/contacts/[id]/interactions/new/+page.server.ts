// src/routes/contacts/[id]/interactions/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { z } from 'zod';

const DraftSchema = z.object({
  text: z.string().min(1, 'Please type something'),
  occurredAt: z.string().optional(),
  channel: z.string().default('note')
});

export const actions = {
  draft: async ({ request }) => {
    const form = await request.formData();
    const parsed = DraftSchema.safeParse({
      text: form.get('text'),
      occurredAt: form.get('occurredAt') || undefined,
      channel: form.get('channel') ?? 'note'
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }
    return { mode: 'draft', draft: parsed.data };
  },

  save: async ({ request, params }) => {
    const form = await request.formData();
    const parsed = DraftSchema.safeParse({
      text: form.get('text'),
      occurredAt: form.get('occurredAt') || undefined,
      channel: form.get('channel') ?? 'note'
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.flatten().formErrors.join(', ') });
    }

    // Parse/normalize occurredAt
    const occurredAt = parsed.data.occurredAt
      ? new Date(parsed.data.occurredAt)
      : new Date();

    const rawTextEnc = encrypt(parsed.data.text, 'interaction.raw_text');

    // Ensure the contact exists (defensive)
    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { id: true }
    });
    if (!contact) {
      return fail(404, { error: 'Contact not found' });
    }

    // Only wrap the DB write in try/catch
    try {
      await prisma.interaction.create({
        data: {
          contactId: contact.id,
          occurredAt,
          channel: parsed.data.channel,
          rawTextEnc
        }
      });
    } catch (err: any) {
      console.error('Failed to save interaction:', err);
      // Handle a common FK violation explicitly
      if (err?.code === 'P2003') {
        return fail(400, {
          error: 'Invalid contact reference. Please reopen the contact and try again.'
        });
      }
      return fail(500, { error: 'Failed to save note. Please try again.' });
    }

    // Do the redirect AFTER the try/catch so it isn’t caught
    throw redirect(303, `/contacts/${contact.id}`);
  }
};

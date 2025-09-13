// src/routes/contacts/[id]/interactions/new/+page.server.ts
// PURPOSE: Create a new interaction for a contact with optional tags and an embedding.
// MULTI TENANT: Requires login and scopes all DB access by userId.
// SECURITY: Do not log decrypted PII. Encrypt raw text before storing.
// NOTE: This route exposes named actions only. Your form should post to ?/save.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { attachInteractionTags } from '$lib/tags';
import { upsertInteractionEmbedding } from '$lib/embeddings';
import { z } from 'zod';

// Validate inputs coming from the form.
const NewInteraction = z.object({
  channel: z.string().min(1),
  occurredAt: z.string().optional(), // datetime-local string
  text: z.string().min(1, 'Note cannot be empty'),
  tags: z.string().optional(), // comma separated names
  tagsSource: z.enum(['user', 'ai']).optional().default('user')
});

export const load: PageServerLoad = async ({ locals, params }) => {
  // Require login.
  if (!locals.user) throw redirect(303, '/auth/login');

  // Ensure the contact exists and belongs to this tenant.
  const contact = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: { id: true }
  });
  if (!contact) throw redirect(303, '/');

  return { contactId: contact.id };
};

// Small local type so we do not depend on App.Locals.
type SaveArgs = {
  request: Request;
  locals: { user?: { id: string } | null };
  params: { id: string };
};

// Shared create function used by named actions.
async function saveImpl({ request, locals, params }: SaveArgs) {
  // Require login.
  if (!locals.user) throw redirect(303, '/auth/login');

  // Parse and validate form fields.
  const raw = Object.fromEntries(await request.formData());
  const parsed = NewInteraction.safeParse({
    channel: String(raw.channel || ''),
    occurredAt: String(raw.occurredAt || ''),
    text: String(raw.text || ''),
    tags: String(raw.tags || ''),
    tagsSource: String(raw.tagsSource || 'user')
  });
  if (!parsed.success) {
    return fail(400, { error: parsed.error.errors[0]?.message || 'Invalid input' });
  }

  // Confirm the contact is in this tenant.
  const contact = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user?.id || '' },
    select: { id: true }
  });
  if (!contact) return fail(404, { error: 'Contact not found.' });

  // Prepare fields.
  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null;
  const plaintext = parsed.data.text;
  const rawTextEnc = encrypt(plaintext, 'interaction.raw_text');

  let interactionId = '';
  try {
    // Create interaction under this tenant.
    const interaction = await prisma.interaction.create({
      data: {
        userId: locals.user!.id,
        contactId: contact.id,
        channel: parsed.data.channel,
        ...(occurredAt ? { occurredAt } : {}),
        rawTextEnc
      },
      select: { id: true }
    });
    interactionId = interaction.id;

    // Attach user provided tags if any.
    const candidates = parsed.data.tags
      ? parsed.data.tags.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (candidates.length > 0) {
      try {
        await attachInteractionTags(
          locals.user!.id,
          interactionId,
          candidates,
          parsed.data.tagsSource ?? 'user'
        );
      } catch (e) {
        console.error('attachInteractionTags failed for interaction', interactionId);
      }
    }
  } catch (err) {
    console.error('Failed to create interaction:', err);
    return fail(500, { error: 'Failed to save note. Please try again.' });
  }

  // Best effort embedding - do not fail the request if it errors.
  try {
    await upsertInteractionEmbedding(locals.user!.id, interactionId, plaintext);
  } catch (e) {
    console.error('upsertInteractionEmbedding failed for interaction', interactionId);
  }

  // Redirect outside try so it is not swallowed.
  throw redirect(303, `/contacts/${contact.id}`);
}

export const actions: Actions = {
  // Your form posts to ?/save.
  save: async (args) => saveImpl(args as SaveArgs),

  // Optional alias so ?/create also works.
  create: async (args) => saveImpl(args as SaveArgs)
};

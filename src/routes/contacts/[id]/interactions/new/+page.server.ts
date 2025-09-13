// src/routes/contacts/[id]/interactions/new/+page.server.ts
// PURPOSE: Create a new interaction for a contact with optional summary, tags, and an embedding.
// MULTI TENANT: Requires login and scopes all DB access by userId.
// SECURITY: Encrypt raw text and summary on the server only. Never log plaintext.
// ACTIONS: Named actions only - your form posts to ?/save.

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
  occurredAt: z.string().optional(),       // datetime-local string
  text: z.string().min(1, 'Note cannot be empty'),
  summary: z.string().optional(),          // optional AI or user summary
  tags: z.string().optional(),             // comma separated names
  tagsSource: z.enum(['user', 'ai']).optional().default('user')
});

export const load: PageServerLoad = async ({ locals, params }) => {
  // Require login.
  if (!locals.user) throw redirect(303, '/auth/login');

  // Ensure the contact exists in this tenant.
  const contact = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: { id: true }
  });
  if (!contact) throw redirect(303, '/');

  return { contactId: contact.id };
};

// Local type so we do not rely on App.Locals here.
type SaveArgs = {
  request: Request;
  locals: { user?: { id: string } | null };
  params: { id: string };
};

async function saveImpl({ request, locals, params }: SaveArgs) {
  // Require login.
  if (!locals.user) throw redirect(303, '/auth/login');

  // Parse and validate form fields.
  const raw = Object.fromEntries(await request.formData());
  const parsed = NewInteraction.safeParse({
    channel: String(raw.channel || ''),
    occurredAt: String(raw.occurredAt || ''),
    text: String(raw.text || ''),
    summary: String(raw.summary || ''),
    tags: String(raw.tags || ''),
    tagsSource: String(raw.tagsSource || 'user')
  });
  if (!parsed.success) {
    // Fix: Zod uses error.issues, not error.errors
    const first = parsed.error.issues?.[0]?.message || 'Invalid input';
    return fail(400, { error: first });
  }

  // Confirm the contact is in this tenant.
  const contact = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user!.id },
    select: { id: true }
  });
  if (!contact) return fail(404, { error: 'Contact not found.' });

  // Prepare fields.
  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null;
  const plaintext = parsed.data.text;
  const summaryPlain = parsed.data.summary?.trim() || '';
  const rawTextEnc = encrypt(plaintext, 'interaction.raw_text');
  const summaryEnc = summaryPlain ? encrypt(summaryPlain, 'interaction.raw_text') : undefined;

  let interactionId = '';
  try {
    // Create interaction under this tenant.
    const created = await prisma.interaction.create({
      data: {
        userId: locals.user!.id,
        contactId: contact.id,
        channel: parsed.data.channel,
        ...(occurredAt ? { occurredAt } : {}),
        rawTextEnc,
        ...(summaryEnc ? { summaryEnc } : {})
      },
      select: { id: true }
    });
    interactionId = created.id;

    // Attach tags if provided - non fatal if helper fails.
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

  // Best effort embedding - do not block on failures.
  try {
    await upsertInteractionEmbedding(locals.user!.id, interactionId, plaintext);
  } catch (e) {
    console.error('upsertInteractionEmbedding failed for interaction', interactionId);
  }

  // Redirect to the contact page.
  throw redirect(303, `/contacts/${contact.id}`);
}

export const actions: Actions = {
  // Your button uses formaction="?/save"
  save: async (args) => saveImpl(args as SaveArgs),
  // Optional alias if some forms still post to ?/create
  create: async (args) => saveImpl(args as SaveArgs)
};

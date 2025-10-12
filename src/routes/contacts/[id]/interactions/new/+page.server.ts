// src/routes/contacts/[id]/interactions/new/+page.server.ts
// PURPOSE: Create a new interaction for a contact with optional summary and a vector embedding.
// MULTI TENANT: Requires login and scopes all DB access by userId.
// SECURITY: Encrypt raw text and summary on the server only. Never log plaintext.
// ACTIONS: Named actions only - your form posts to ?/save.
// TAG BEHAVIOR: Tags are attached to the Contact only - never to the Interaction.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { encrypt, decrypt } from '$lib/crypto';
// IT: we attach tags to the Contact, so we need a helper to resolve or create tag ids
import { resolveOrCreateTagForTenant } from '$lib/tags';
import { upsertInteractionEmbedding } from '$lib/embeddings';
import { z } from 'zod';

// Validate inputs coming from the form.
const NewInteraction = z.object({
  channel: z.string().min(1),
  occurredAt: z.string().optional(),       // datetime-local string
  text: z.string().min(1, 'Note cannot be empty'),
  summary: z.string().optional(),          // optional AI or user summary
  tags: z.string().optional(),             // comma separated names the user typed
  tagsSource: z.enum(['user', 'ai']).optional().default('user')
});


// add this load - if you already have one, just merge the contact read and return
export const load: PageServerLoad = async ({ params, locals }) => {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // Read the contact for this tenant - only the fields we need
  const row = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: { id: true, fullNameEnc: true }
  });
  if (!row) throw redirect(303, '/contacts');

  // Decrypt on server only
  let name = '(name unavailable)';
  try { name = decrypt(row.fullNameEnc, 'contact.full_name'); } catch {}

  // Keep it simple for the svelte page
  return { contact: { id: row.id, name } };
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
    // IT: Zod uses error.issues, not error.errors
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
  const rawTextEnc = encrypt(plaintext, 'interaction.raw_text'); // IT: AAD string is stable
  const summaryEnc = summaryPlain ? encrypt(summaryPlain, 'interaction.raw_text') : undefined;

  let interactionId = '';
  try {
    // Create interaction under this tenant.
    const created = await prisma.interaction.create({
      data: {
        userId: locals.user!.id,              // IT: tenant scope on create
        contactId: contact.id,               // IT: link to parent contact
        channel: parsed.data.channel,
        ...(occurredAt ? { occurredAt } : {}),
        rawTextEnc,
        ...(summaryEnc ? { summaryEnc } : {})
      },
      select: { id: true }
    });
    interactionId = created.id;

        // IT: bump the contact's lastContactedAt when a new interaction is created
    try {
      await prisma.contact.updateMany({
        // Tenant guard - only update this user's contact
        where: { id: contact.id, userId: locals.user!.id },
        // Use the interaction occurredAt if provided, else now
        data: { lastContactedAt: occurredAt ?? new Date() }
      });
    } catch (e) {
      // Non fatal - do not block the note save if this fails
      console.error('[interactions:new] failed to update lastContactedAt', { contactId: contact.id });
    }


    // IT: attach any typed tags to the Contact - not to the Interaction
    // - We ignore AI tags here. If the UI wants AI suggestions, it should display chips and let the user click to add.
    const candidates = parsed.data.tags
      ? parsed.data.tags.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    if (candidates.length > 0) {
      // IT: resolve or create each tag for this tenant
      const resolved = [];
      for (const name of candidates) {
        try {
          const tag = await resolveOrCreateTagForTenant(
            locals.user!.id,          // IT: tenant owner
            name,                     // IT: human label or slug source
            parsed.data.tagsSource    // IT: provenance for auditing
          );
          resolved.push(tag);
        } catch {
          // IT: continue on a single tag failure
        }
      }

      // IT: link each resolved tag to the Contact via ContactTag
      for (const tag of resolved) {
        try {
          await prisma.contactTag.create({
            data: {
              contactId: contact.id,
              tagId: tag.id,
              assignedBy: parsed.data.tagsSource // IT: enum AssignedBy
            }
          });
        } catch {
          // IT: ignore if the link already exists due to composite PK or unique constraint
        }
      }
    }
  } catch (err) {
    console.error('Failed to create interaction:', err);
    return fail(500, { error: 'Failed to save note. Please try again.' });
  }

  // Best effort embedding - do not block on failures.
  try {
    // IT: upsertInteractionEmbedding should compute the vector and write InteractionEmbedding.vec
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

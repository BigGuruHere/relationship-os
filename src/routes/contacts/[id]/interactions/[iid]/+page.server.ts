// src/routes/contacts/[id]/interactions/[iid]/+page.server.ts
// PURPOSE: View, tag, and delete a single interaction. Decrypt note and summary on the server.
// SECURITY: never log decrypted content. Only log IDs and generic errors.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { attachInteractionTags, detachInteractionTag } from '$lib/tags';

// Load a single interaction and verify it belongs to the contact in the URL
export const load = async ({ params }) => {
  // Fetch interaction plus its tags through the join table
  const row = await prisma.interaction.findFirst({
    where: { id: params.iid, contactId: params.id },
    select: {
      id: true,
      contactId: true,
      occurredAt: true,
      channel: true,
      rawTextEnc: true,
      summaryEnc: true,
      tags: { select: { tag: { select: { name: true, slug: true } } } }
    }
  });

  if (!row) return { notFound: true };

  // Decrypt note text using the correct AAD
  let text = '';
  try {
    text = decrypt(row.rawTextEnc, 'interaction.raw_text');
  } catch {
    text = '⚠︎ Unable to decrypt note';
  }

  // Decrypt optional summary using the correct AAD
  let summary: string | null = null;
  try {
    summary = row.summaryEnc ? decrypt(row.summaryEnc, 'interaction.summary') : null;
  } catch {
    summary = null;
  }

  // Flatten tags for the UI
  const tags = row.tags.map((t) => t.tag);

  return {
    interaction: {
      id: row.id,
      contactId: row.contactId,
      occurredAt: row.occurredAt,
      channel: row.channel,
      text,
      summary,
      tags
    }
  };
};

// Actions for adding and removing tags, plus delete
export const actions = {
  // Add a single tag by name to this interaction
  addTag: async ({ request, params }) => {
    const form = await request.formData();
    const raw = String(form.get('tag') || '');
    const name = raw.trim();
    if (!name) return fail(400, { error: 'Enter a tag' });

    try {
      await attachInteractionTags(params.iid, [name], 'user');
    } catch (e) {
      // Do not leak content. Log minimal context.
      console.error('attachInteractionTags failed for interaction', params.iid);
      // Non fatal - still redirect
    }

    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  // Remove a tag by slug from this interaction
  removeTag: async ({ request, params }) => {
    const form = await request.formData();
    const slug = String(form.get('slug') || '').trim();
    if (!slug) return fail(400, { error: 'Missing tag' });

    try {
      await detachInteractionTag(params.iid, slug);
    } catch (e) {
      console.error('detachInteractionTag failed for interaction', params.iid);
    }

    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  // Delete this interaction and go back to the contact page
  delete: async ({ params }) => {
    try {
      const res = await prisma.interaction.deleteMany({
        where: { id: params.iid, contactId: params.id }
      });
      if (res.count === 0) {
        return fail(404, { error: 'Interaction not found or already deleted.' });
      }
    } catch (err) {
      console.error('Failed to delete interaction (DB error):', err);
      return fail(500, { error: 'Failed to delete note. Please try again.' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  }
};

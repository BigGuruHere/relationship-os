// src/routes/contacts/[id]/interactions/[iid]/+page.server.ts
// PURPOSE: View, tag, and delete a single interaction. Decrypt note on the server.
// MULTI TENANT: All operations require locals.user and are scoped by userId.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { attachInteractionTags, detachInteractionTag } from '$lib/tags';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  // Fetch interaction plus tags within this tenant and ensure it belongs to the contact
  const row = await prisma.interaction.findFirst({
    where: { id: params.iid, contactId: params.id, userId: locals.user.id },
    select: {
      id: true,
      contactId: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      // The `tags` relation on Interaction points to InteractionTag rows.
      // Filter by nested Tag.userId and select Tag fields via tag{}
      tags: {
        where: { tag: { userId: locals.user.id } },
        select: { tag: { select: { name: true, slug: true } } },
        orderBy: { tag: { name: 'asc' } }
      }
    }
  });

  if (!row) return { notFound: true };

  // Decrypt on server
  let text = '(unavailable)';
  try {
    text = row.rawTextEnc ? decrypt(row.rawTextEnc, 'interaction.raw_text') : '(empty)';
  } catch {}

  const tags = row.tags.map((it) => ({ name: it.tag.name, slug: it.tag.slug }));

  return {
    interaction: {
      id: row.id,
      contactId: row.contactId,
      channel: row.channel,
      occurredAt: row.occurredAt,
      text,
      tags
    }
  };
};

export const actions: Actions = {
  addTag: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    if (!name) return fail(400, { error: 'Missing tag name.' });

    // Ensure row exists and is in this tenant
    const exists = await prisma.interaction.findFirst({
      where: { id: params.iid, contactId: params.id, userId: locals.user.id },
      select: { id: true }
    });
    if (!exists) return fail(404, { error: 'Interaction not found.' });

    try {
      await attachInteractionTags(locals.user.id, params.iid, [name], 'user');
    } catch (e) {
      console.error('attachInteractionTags failed for interaction', params.iid);
      return fail(500, { error: 'Failed to add tag.' });
    }

    // Redirect outside the try/catch
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  removeTag: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const slug = String(form.get('slug') || '').trim();
    if (!slug) return fail(400, { error: 'Missing tag.' });

    try {
      await detachInteractionTag(locals.user.id, params.iid, slug);
    } catch (e) {
      console.error('detachInteractionTag failed for interaction', params.iid);
      return fail(500, { error: 'Failed to remove tag.' });
    }

    // Redirect outside the try/catch
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  delete: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    try {
      // Restrict delete to rows in this tenant and belonging to this contact
      const res = await prisma.interaction.deleteMany({
        where: { id: params.iid, contactId: params.id, userId: locals.user.id }
      });
      if (res.count === 0) return fail(404, { error: 'Interaction not found or already deleted.' });
    } catch (err) {
      console.error('Failed to delete interaction:', err);
      return fail(500, { error: 'Failed to delete note. Please try again.' });
    }

    // Redirect outside the try/catch
    throw redirect(303, `/contacts/${params.id}`);
  }
};

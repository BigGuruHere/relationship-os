// PURPOSE: Interaction detail - show one note and manage its tags.
// TENANCY: Every read and write is scoped by userId from locals.
// SECURITY: Decrypt only on the server.
// ACTIONS: Named actions addTag and removeTag. No default action is exported.

import type { Actions, PageServerLoad } from './$types';
import { redirect, error,fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

// Small util - normalize a human tag to a slug
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export const load: PageServerLoad = async ({ params, locals }) => {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login');

  const userId = locals.user.id;
  const contactId = params.id;
  const interactionId = params.iid;

  // Fetch the interaction for this tenant - include contact and tags
  const row = await prisma.interaction.findFirst({
    where: { id: interactionId, userId },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      summaryEnc: true,
      contactId: true,
      contact: { select: { fullNameEnc: true } },
      tags: {
        select: { tag: { select: { name: true, slug: true } } },
        orderBy: { assignedAt: 'asc' }
      }
    }
  });
  if (!row) throw error(404, 'Interaction not found');

  // Decrypt minimal fields for display
  let contactName = '';
  let text = '';
  let summary = '';
  try { contactName = row.contact?.fullNameEnc ? decrypt(row.contact.fullNameEnc, 'contact.full_name') : ''; } catch {}
  try { text = row.rawTextEnc ? decrypt(row.rawTextEnc, 'interaction.raw_text') : ''; } catch {}
  try { summary = row.summaryEnc ? decrypt(row.summaryEnc, 'interaction.summary') : ''; } catch {}

  return {
    interaction: {
      id: row.id,
      contactId: row.contactId,
      contactName,
      channel: row.channel,
      occurredAt: row.occurredAt,
      text,
      summary
    },
    // Flatten to what your chip UI expects
    tags: row.tags.map((t) => ({ name: t.tag.name, slug: t.tag.slug })),
    // Absolute href back to this page - used for safe redirects
    selfHref: `/contacts/${contactId}/interactions/${interactionId}`
  };
};

export const actions: Actions = {
  // IT: hard delete this note, then redirect back to its parent contact
  delete: async ({ locals, params }) => {
    // IT: require login
    if (!locals.user) throw redirect(303, '/auth/login');

    // IT: fetch the note and capture its contactId before deleting
    const note = await prisma.interaction.findFirst({
      where: { id: params.iid, userId: locals.user.id },
      select: { id: true, contactId: true }
    });
    if (!note) return fail(404, { error: 'Note not found' });

    const contactId = note.contactId;

    try {
      await prisma.interaction.delete({ where: { id: note.id } }); // IT: delete the note
    } catch (err) {
      console.error('delete note failed', err);
      return fail(500, { error: 'Failed to delete note' });
    }

    // IT: redirect to the contact page
    throw redirect(303, `/contacts/${contactId}`);
  }
};


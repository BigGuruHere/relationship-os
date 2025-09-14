// PURPOSE: Interaction detail - show one note and manage its tags.
// TENANCY: Every read and write is scoped by userId from locals.
// SECURITY: Decrypt only on the server.
// ACTIONS: Named actions addTag and removeTag. No default action is exported.

import type { Actions, PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
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
  // Add a user defined tag to this interaction - creates Tag if missing
  addTag: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const interactionId = params.iid;

    // Ensure this interaction belongs to the tenant
    const exists = await prisma.interaction.findFirst({
      where: { id: interactionId, userId },
      select: { id: true }
    });
    if (!exists) throw error(404, 'Interaction not found');

    const data = await request.formData();
    // Support input named "name" or "tag" - optional comma separated
    const raw = String(data.get('name') ?? data.get('tag') ?? '').trim();
    if (!raw) {
      // Empty input - go back without error
      throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
    }

    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10); // safety bound

    for (const name of names) {
      const slug = slugify(name);
      if (!slug) continue;

      // Upsert the tag for this tenant
      const tag = await prisma.tag.upsert({
        where: { userId_slug: { userId, slug } },
        update: { name },
        create: { userId, name, slug, createdBy: 'user' }
      });

      // Link to the interaction - ignore if already linked
      await prisma.interactionTag.upsert({
        where: { interactionId_tagId: { interactionId, tagId: tag.id } },
        update: {},
        create: { interactionId, tagId: tag.id, assignedBy: 'user' }
      });
    }

    // Important - redirect to the absolute URL so we never drop the iid
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  },

  // Remove a tag from this interaction by slug
  removeTag: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const interactionId = params.iid;

    // Ensure this interaction belongs to the tenant
    const exists = await prisma.interaction.findFirst({
      where: { id: interactionId, userId },
      select: { id: true }
    });
    if (!exists) throw error(404, 'Interaction not found');

    const data = await request.formData();
    const slug = slugify(String(data.get('slug') || ''));
    if (!slug) {
      throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
    }

    // Find the tag id for this tenant
    const tag = await prisma.tag.findFirst({
      where: { userId, slug },
      select: { id: true }
    });

    if (tag) {
      await prisma.interactionTag.deleteMany({
        where: { interactionId, tagId: tag.id }
      });
    }

    // Redirect back to the same interaction page
    throw redirect(303, `/contacts/${params.id}/interactions/${params.iid}`);
  }
};

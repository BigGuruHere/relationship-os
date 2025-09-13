// src/routes/contacts/[id]/+page.server.ts
// PURPOSE: Load a single contact with its tags and recent interactions, and provide actions to add or remove tags.
// MULTI TENANT: All reads and writes require locals.user and are filtered by userId.
// SECURITY: Decrypt only on the server. Never log decrypted PII. All IT code is commented and uses hyphens only.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { attachContactTags, detachContactTag } from '$lib/tags';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Comment: require login before reading tenant data.
  if (!locals.user) throw redirect(303, '/auth/login');

  // Comment: fetch the contact for this tenant and include tag links via the join table.
  const row = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      createdAt: true,
      tags: {
        // Comment: Contact.tags is ContactTag rows - filter by nested Tag.userId for safety.
        where: { tag: { userId: locals.user.id } },
        select: { tag: { select: { name: true, slug: true } } },
        orderBy: { tag: { name: 'asc' } }
      }
    }
  });

  // Comment: if contact not found for this tenant, go home.
  if (!row) throw redirect(303, '/');

  // Comment: decrypt PII on the server with placeholders on failure.
  let name = '(name unavailable)';
  let email: string | null = null;
  let phone: string | null = null;
  try {
    name = decrypt(row.fullNameEnc, 'contact.full_name');
  } catch {}
  try {
    email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null;
  } catch {}
  try {
    phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null;
  } catch {}

  // Comment: map ContactTag rows to a simple tag array.
  const tags = row.tags.map((ct) => ({ name: ct.tag.name, slug: ct.tag.slug }));

  // Comment: fetch recent interactions for this contact within this tenant and decrypt previews.
  const interactionsRaw = await prisma.interaction.findMany({
    where: { userId: locals.user.id, contactId: params.id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      tags: {
        where: { tag: { userId: locals.user.id } },
        select: { tag: { select: { name: true, slug: true } } },
        orderBy: { tag: { name: 'asc' } }
      }
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 50 // Comment: cap for UI - adjust as needed.
  });

  // Comment: decrypt note previews - keep it short for the list.
  const interactions = interactionsRaw.map((it) => {
    let text = '';
    try {
      text = it.rawTextEnc ? decrypt(it.rawTextEnc, 'interaction.raw_text') : '';
    } catch {}
    const preview = text.length > 280 ? text.slice(0, 277) + '...' : text;
    return {
      id: it.id,
      channel: it.channel,
      occurredAt: it.occurredAt,
      preview,
      tags: it.tags.map((t) => ({ name: t.tag.name, slug: t.tag.slug }))
    };
  });

  return {
    contact: { id: row.id, name, email, phone, createdAt: row.createdAt, tags },
    interactions
  };
};

export const actions: Actions = {
  addTag: async ({ request, params, locals }) => {
    // Comment: require login for writes.
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    if (!name) return fail(400, { error: 'Missing tag name.' });

    try {
      await attachContactTags(locals.user.id, params.id, [name], 'user');
    } catch (e) {
      console.error('attachContactTags failed for contact', params.id);
      return fail(500, { error: 'Failed to add tag.' });
    }

    // Comment: redirect outside try so it is not swallowed.
    throw redirect(303, `/contacts/${params.id}`);
  },

  removeTag: async ({ request, params, locals }) => {
    // Comment: require login for writes.
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const slug = String(form.get('slug') || '').trim();
    if (!slug) return fail(400, { error: 'Missing tag.' });

    try {
      await detachContactTag(locals.user.id, params.id, slug);
    } catch (e) {
      console.error('detachContactTag failed for contact', params.id);
      return fail(500, { error: 'Failed to remove tag.' });
    }

    // Comment: redirect outside try so it is not swallowed.
    throw redirect(303, `/contacts/${params.id}`);
  }
};

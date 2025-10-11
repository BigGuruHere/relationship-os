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

  // Comment: fetch the contact for this tenant and include cadence fields and tag links.
  const row = await prisma.contact.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      createdAt: true,

      // IT: cadence fields
      reconnectEveryDays: true,
      lastContactedAt: true,

      // IT: tags via join table
      tags: {
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
  try { name = decrypt(row.fullNameEnc, 'contact.full_name'); } catch {}
  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null; } catch {}

  // Comment: map ContactTag rows to a simple tag array.
  const tags = row.tags.map((ct) => ({ name: ct.tag.name, slug: ct.tag.slug }));

  // Comment: fetch recent interactions for this contact within this tenant and decrypt previews.
  const interactionsRaw = await prisma.interaction.findMany({
    where: { userId: locals.user.id, contactId: params.id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 50
  });

  // Comment: decrypt note previews - keep it short for the list.
  const interactions = interactionsRaw.map((it) => {
    let text = '';
    try { text = it.rawTextEnc ? decrypt(it.rawTextEnc, 'interaction.raw_text') : ''; } catch {}
    const preview = text.length > 280 ? text.slice(0, 277) + '...' : text;
    return {
      id: it.id,
      channel: it.channel,
      occurredAt: it.occurredAt,
      preview
    };
  });

  return {
    contact: {
      id: row.id,
      name,
      email,
      phone,
      createdAt: row.createdAt,
      reconnectEveryDays: row.reconnectEveryDays ?? null,
      lastContactedAt: row.lastContactedAt ?? null,
      tags
    },
    interactions
  };
};


export const actions: Actions = {
  addTag: async ({ request, params, locals }) => {
    // require login
    if (!locals.user) throw redirect(303, '/auth/login');
  
    const form = await request.formData();
    const raw = String(form.get('name') ?? form.get('tag') ?? '').trim();
  
    // debug - log the incoming payload
    console.log('[contacts:addTag] start', {
      userId: locals.user.id,
      contactId: params.id,
      raw
    });
  
    if (!raw) {
      console.warn('[contacts:addTag] empty input');
      return fail(400, { error: 'Missing tag name.' });
    }
  
    // allow comma-separated input
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
  
    console.log('[contacts:addTag] normalized names', names);
  
    try {
      // IMPORTANT - call with the expected object args
      await attachContactTags({
        userId: locals.user.id,
        contactId: params.id,
        names,
        provenance: 'user'
      });
  
      console.log('[contacts:addTag] attachContactTags OK', { contactId: params.id, count: names.length });
    } catch (e: any) {
      console.error('[contacts:addTag] attachContactTags failed', {
        contactId: params.id,
        message: e?.message,
        code: e?.code,
        stack: e?.stack
      });
      return fail(500, { error: 'Failed to add tag.' });
    }
  
    // redirect back to the contact page
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
  },

  // IT: set or clear reconnect cadence in days for this contact
  setCadence: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
  
    const form = await request.formData();
    const raw = String(form.get('days') ?? '').trim();
    const days = raw === '' ? null : Number.parseInt(raw, 10);
  
    console.log('[contacts:setCadence] input', {
      contactId: params.id,
      userId: locals.user.id,
      raw,
      parsedDays: days
    });
  
    if (days !== null && (!Number.isFinite(days) || days < 1 || days > 3650)) {
      return fail(400, { error: 'Cadence must be between 1 and 3650 days' });
    }
  
    try {
      const res = await prisma.contact.updateMany({
        where: { id: params.id, userId: locals.user.id },
        data: { reconnectEveryDays: days }
      });
  
      console.log('[contacts:setCadence] updateMany result', res);
  
      // IT: if nothing updated, surface a clear error - likely wrong id or tenant scope
      if (!res.count) {
        return fail(404, { error: 'Contact not found for this user' });
      }
    } catch (e) {
      console.error('[contacts:setCadence] failed', e);
      return fail(500, { error: 'Failed to update cadence' });
    }
  
    throw redirect(303, `/contacts/${params.id}`);
  },
  

// IT: set lastContactedAt to now - useful after you reach out
markContactedToday: async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  try {
    await prisma.contact.updateMany({
      where: { id: params.id, userId: locals.user.id }, // tenant scoped
      data: { lastContactedAt: new Date() }
    });
  } catch (e) {
    console.error('[contacts:markContactedToday] failed', { contactId: params.id, err: e });
    return fail(500, { error: 'Failed to mark contacted' });
  }

  throw redirect(303, `/contacts/${params.id}`);
},


};

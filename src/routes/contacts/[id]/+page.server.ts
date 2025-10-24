// src/routes/contacts/[id]/+page.server.ts
// PURPOSE: Load a single contact with its tags and recent interactions, and provide actions to add or remove tags.
// MULTI TENANT: All reads and writes require locals.user and are filtered by userId.
// SECURITY: Decrypt only on the server. Never log decrypted PII. All IT code is commented and uses hyphens only.

import { prisma } from '$lib/db';
import { decrypt, encrypt, buildIndexToken } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { attachContactTags, detachContactTag } from '$lib/tags';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  // require login before reading tenant data
  if (!locals.user) throw redirect(303, '/auth/login');

  const id = params.id;

  // fetch the contact for this tenant and include cadence fields and tag links
  const row = await prisma.contact.findFirst({
    where: { id, userId: locals.user.id },
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      companyEnc: true,
      // new fields - position and linkedin
      positionEnc: true,
      linkedinEnc: true,

      createdAt: true,
      reconnectEveryDays: true,
      lastContactedAt: true,
      tags: {
        select: {
          tag: { select: { name: true, slug: true } }
        }
      }
    }
  });

  // if contact not found for this tenant, go home - this matches your previous behavior
  if (!row) throw redirect(303, '/');

  // decrypt PII on the server with placeholders on failure
  let name = '(name unavailable)';
  let email: string | null = null;
  let phone: string | null = null;
  let company: string | null = null;
  let position: string | null = null;   // new
  let linkedin: string | null = null;   // new

  try { name = decrypt(row.fullNameEnc, 'contact.full_name'); } catch {}
  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null; } catch {}
  try { company = row.companyEnc ? decrypt(row.companyEnc, 'contact.company') : null; } catch {}
  try { position = row.positionEnc ? decrypt(row.positionEnc, 'contact.position') : null; } catch {}
  try { linkedin = row.linkedinEnc ? decrypt(row.linkedinEnc, 'contact.linkedin') : null; } catch {}

  // map ContactTag rows to a simple tag array
  const tags = row.tags.map((ct) => ({ name: ct.tag.name, slug: ct.tag.slug }));

  // fetch recent interactions for this contact within this tenant and decrypt previews
  const interactionsRaw = await prisma.interaction.findMany({
    where: { userId: locals.user.id, contactId: id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 50
  });

  // decrypt note previews - keep it short for the list
  const interactions = interactionsRaw.map((it) => {
    let text = '';
    try { text = it.rawTextEnc ? decrypt(it.rawTextEnc, 'interaction.raw_text') : ''; } catch {}
    const preview = text.length > 280 ? text.slice(0, 277) + '...' : text;
    return {
      id: it.id,
      channel: it.channel,
      occurredAt: it.occurredAt,
      preview,
      tags: [] // interactions do not carry tags in this design - set empty array for safe rendering
    };
  });

  // fetch open reminders for this contact - due soon to later
  const reminders = await prisma.reminder.findMany({
    where: { userId: locals.user.id, contactId: id, completedAt: null },
    select: { id: true, dueAt: true, note: true },
    orderBy: { dueAt: 'asc' }
  });

  // return the shape your page expects - unchanged, plus the two new fields
  return {
    contact: {
      id: row.id,
      name,                               // always a string
      email: email || '',                  // normalize null -> ''
      phone: phone || '',                  // normalize null -> ''
      company: company || '',              // normalize null -> ''
      position: position || '',            // new
      linkedin: linkedin || '',            // new
      createdAt: row.createdAt,
      reconnectEveryDays: row.reconnectEveryDays ?? null,
      lastContactedAt: row.lastContactedAt ?? null,
      tags
    },
    interactions,
    reminders
  };
};

export const actions: Actions = {
  addTag: async ({ request, params, locals }) => {
    // require login
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const raw = String(form.get('name') ?? form.get('tag') ?? '').trim();

    if (!raw) {
      return fail(400, { error: 'Missing tag name.' });
    }

    // allow comma-separated input
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    try {
      await attachContactTags({
        userId: locals.user.id,
        contactId: params.id,
        names,
        provenance: 'user'
      });
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
    // require login for writes
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const slug = String(form.get('slug') || '').trim();
    if (!slug) return fail(400, { error: 'Missing tag.' });

    try {
      await detachContactTag(locals.user.id, params.id, slug);
    } catch (e) {
      console.error('[contacts:removeTag] detachContactTag failed', { contactId: params.id, err: e });
      return fail(500, { error: 'Failed to remove tag.' });
    }

    // redirect outside try so it is not swallowed
    throw redirect(303, `/contacts/${params.id}`);
  },

  // set or clear reconnect cadence in days for this contact
  setCadence: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const raw = String(form.get('days') ?? '').trim();
    const days = raw === '' ? null : Number.parseInt(raw, 10);

    if (days !== null && (!Number.isFinite(days) || days < 1 || days > 3650)) {
      return fail(400, { error: 'Cadence must be between 1 and 3650 days' });
    }

    try {
      const res = await prisma.contact.updateMany({
        where: { id: params.id, userId: locals.user.id },
        data: { reconnectEveryDays: days }
      });

      if (!res.count) {
        return fail(404, { error: 'Contact not found for this user' });
      }
    } catch (e) {
      console.error('[contacts:setCadence] failed', e);
      return fail(500, { error: 'Failed to update cadence' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  // set lastContactedAt to now
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

  // create a one-shot reminder for this contact
  createReminder: async ({ request, params, locals }) => {
    // require login
    if (!locals.user) throw redirect(303, '/auth/login');

    // parse and validate fields from the form
    const form = await request.formData();
    const dueAtRaw = String(form.get('dueAt') ?? '').trim();   // expected datetime-local
    const note = String(form.get('note') ?? '').trim();

    // datetime-local comes without timezone, treat as local and construct Date
    if (!dueAtRaw) return fail(400, { error: 'Due date is required' });
    const dueAt = new Date(dueAtRaw);
    if (isNaN(dueAt.getTime())) {
      return fail(400, { error: 'Invalid due date' });
    }

    // ensure this contact belongs to the tenant
    const exists = await prisma.contact.findFirst({
      where: { id: params.id, userId: locals.user.id },
      select: { id: true }
    });
    if (!exists) return fail(404, { error: 'Contact not found' });

    try {
      // insert the reminder - tenant scoped by userId and contactId
      await prisma.reminder.create({
        data: {
          userId: locals.user.id,
          contactId: params.id,
          dueAt,
          note: note || null
        }
      });
    } catch (e) {
      console.error('[contacts:createReminder] failed', { contactId: params.id, err: e });
      return fail(500, { error: 'Failed to create reminder' });
    }

    // back to the contact page
    throw redirect(303, `/contacts/${params.id}`);
  },

  // mark a reminder complete
  completeReminder: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const reminderId = String(form.get('reminderId') ?? '').trim();
    if (!reminderId) return fail(400, { error: 'Missing reminder id' });

    try {
      const res = await prisma.reminder.updateMany({
        where: { id: reminderId, userId: locals.user.id, contactId: params.id, completedAt: null },
        data: { completedAt: new Date() }
      });
      if (!res.count) return fail(404, { error: 'Reminder not found' });
    } catch (e) {
      console.error('[contacts:completeReminder] failed', { contactId: params.id, reminderId, err: e });
      return fail(500, { error: 'Failed to complete reminder' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  // delete a reminder entirely
  deleteReminder: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const reminderId = String(form.get('reminderId') ?? '').trim();
    if (!reminderId) return fail(400, { error: 'Missing reminder id' });

    try {
      const res = await prisma.reminder.deleteMany({
        where: { id: reminderId, userId: locals.user.id, contactId: params.id }
      });
      if (!res.count) return fail(404, { error: 'Reminder not found' });
    } catch (e) {
      console.error('[contacts:deleteReminder] failed', { contactId: params.id, reminderId, err: e });
      return fail(500, { error: 'Failed to delete reminder' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  }
};

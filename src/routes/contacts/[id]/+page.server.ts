// src/routes/contacts/[id]/+page.server.ts
// PURPOSE: Load contact with relationships and provide add/remove actions
// SECURITY: All queries tenant-scoped by userId

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { attachContactTags, detachContactTag } from '$lib/tags';
import type { Actions, PageServerLoad } from './$types';
import { getBestDisplayName } from '$lib/server/names';

// IT: helper to detect placeholder names
function isPlaceholderName(name: string | null | undefined): boolean {
  const s = (name || '').trim().toLowerCase();
  return !s || s === 'new connection' || s === 'relish user';
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const id = params.id;

  // IT: fetch contact with relationships
  const row = await prisma.contact.findFirst({
    where: { id, userId: locals.user.id },
    select: {
      id: true,
      linkedUserId: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      companyEnc: true,
      positionEnc: true,
      linkedinEnc: true,
      createdAt: true,
      reconnectEveryDays: true,
      lastContactedAt: true,
      tags: {
        select: {
          tag: { select: { name: true, slug: true } }
        }
      },
      // IT: NEW - load relationships where this contact is either side
      relationshipsAsA: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          isDirectional: true,
          contactB: {
            select: {
              id: true,
              fullNameEnc: true,
              linkedUserId: true
            }
          }
        }
      },
      relationshipsAsB: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          isDirectional: true,
          contactA: {
            select: {
              id: true,
              fullNameEnc: true,
              linkedUserId: true
            }
          }
        }
      }
    }
  });

  if (!row) throw redirect(303, '/');

  // IT: decrypt contact PII
  let name = '';
  let email: string | null = null;
  let phone: string | null = null;
  let company: string | null = null;
  let position: string | null = null;
  let linkedin: string | null = null;

  try { name = row.fullNameEnc ? decrypt(row.fullNameEnc, 'contact.full_name') : ''; } catch {}
  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null; } catch {}
  try { company = row.companyEnc ? decrypt(row.companyEnc, 'contact.company') : null; } catch {}
  try { position = row.positionEnc ? decrypt(row.positionEnc, 'contact.position') : null; } catch {}
  try { linkedin = row.linkedinEnc ? decrypt(row.linkedinEnc, 'contact.linkedin') : null; } catch {}

  // IT: live name fallback
  if (row.linkedUserId && isPlaceholderName(name)) {
    try {
      name = await getBestDisplayName(row.linkedUserId);
    } catch {}
  }
  if (!name) name = 'Relish user';

  // IT: map tags
  const tags = row.tags.map((ct) => ({ name: ct.tag.name, slug: ct.tag.slug }));

  // IT: NEW - process relationships and decrypt related contact names
  const relationships = [];

  // IT: process relationshipsAsA (this contact is contactA)
  for (const rel of row.relationshipsAsA) {
    let otherName = '';
    try {
      otherName = rel.contactB.fullNameEnc 
        ? decrypt(rel.contactB.fullNameEnc, 'contact.full_name') 
        : '';
    } catch {}

    // IT: live name fallback for related contact
    if (rel.contactB.linkedUserId && isPlaceholderName(otherName)) {
      try {
        otherName = await getBestDisplayName(rel.contactB.linkedUserId);
      } catch {}
    }
    if (!otherName) otherName = 'Relish user';

    relationships.push({
      id: rel.id,
      otherContactId: rel.contactB.id,
      otherContactName: otherName,
      type: rel.relationshipType,
      label: rel.label || 'knows',
      isDirectional: rel.isDirectional,
      direction: 'outgoing' as const // this contact → other
    });
  }

  // IT: process relationshipsAsB (this contact is contactB)
  for (const rel of row.relationshipsAsB) {
    let otherName = '';
    try {
      otherName = rel.contactA.fullNameEnc 
        ? decrypt(rel.contactA.fullNameEnc, 'contact.full_name') 
        : '';
    } catch {}

    if (rel.contactA.linkedUserId && isPlaceholderName(otherName)) {
      try {
        otherName = await getBestDisplayName(rel.contactA.linkedUserId);
      } catch {}
    }
    if (!otherName) otherName = 'Relish user';

    relationships.push({
      id: rel.id,
      otherContactId: rel.contactA.id,
      otherContactName: otherName,
      type: rel.relationshipType,
      label: rel.label || 'knows',
      isDirectional: rel.isDirectional,
      direction: 'incoming' as const // other → this contact
    });
  }

  // IT: fetch interactions
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

  const interactions = interactionsRaw.map((it) => {
    let text = '';
    try { text = it.rawTextEnc ? decrypt(it.rawTextEnc, 'interaction.raw_text') : ''; } catch {}
    const preview = text.length > 280 ? text.slice(0, 277) + '...' : text;
    return {
      id: it.id,
      channel: it.channel,
      occurredAt: it.occurredAt,
      preview,
      tags: []
    };
  });

  // IT: fetch reminders
  const reminders = await prisma.reminder.findMany({
    where: { userId: locals.user.id, contactId: id, completedAt: null },
    select: { id: true, dueAt: true, note: true },
    orderBy: { dueAt: 'asc' }
  });

  // IT: fetch all contacts for relationship dropdown (exclude current contact)
  const allContacts = await prisma.contact.findMany({
    where: { 
      userId: locals.user.id,
      id: { not: id } // exclude current contact
    },
    select: {
      id: true,
      fullNameEnc: true,
      linkedUserId: true
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  // IT: decrypt contact names for dropdown
  const contactOptions = await Promise.all(
    allContacts.map(async (c) => {
      let contactName = '';
      try {
        contactName = c.fullNameEnc ? decrypt(c.fullNameEnc, 'contact.full_name') : '';
      } catch {}

      if (c.linkedUserId && isPlaceholderName(contactName)) {
        try {
          contactName = await getBestDisplayName(c.linkedUserId);
        } catch {}
      }
      if (!contactName) contactName = 'Relish user';

      return {
        id: c.id,
        name: contactName
      };
    })
  );

  return {
    contact: {
      id: row.id,
      name,
      email: email || '',
      phone: phone || '',
      company: company || '',
      position: position || '',
      linkedin: linkedin || '',
      createdAt: row.createdAt,
      reconnectEveryDays: row.reconnectEveryDays ?? null,
      lastContactedAt: row.lastContactedAt ?? null,
      tags
    },
    relationships, // IT: NEW
    contactOptions, // IT: NEW - for dropdown
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
    },
  
  
  addRelationship: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const otherContactId = String(form.get('otherContactId') || '').trim();
    const label = String(form.get('label') || '').trim() || 'knows';

    if (!otherContactId) {
      return fail(400, { error: 'Please select a contact' });
    }

    // IT: verify both contacts belong to this user
    const [contactA, contactB] = await Promise.all([
      prisma.contact.findFirst({
        where: { id: params.id, userId: locals.user.id },
        select: { id: true }
      }),
      prisma.contact.findFirst({
        where: { id: otherContactId, userId: locals.user.id },
        select: { id: true }
      })
    ]);

    if (!contactA || !contactB) {
      return fail(404, { error: 'Contact not found' });
    }

    // IT: create relationship
    try {
      await prisma.contactRelationship.create({
        data: {
          userId: locals.user.id,
          contactAId: params.id,
          contactBId: otherContactId,
          label,
          isDirectional: false
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return fail(409, { error: 'This relationship already exists' });
      }
      console.error('[addRelationship] failed:', err);
      return fail(500, { error: 'Failed to add relationship' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  // IT: NEW - remove relationship
  removeRelationship: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const relationshipId = String(form.get('relationshipId') || '').trim();

    if (!relationshipId) {
      return fail(400, { error: 'Missing relationship ID' });
    }

    try {
      // IT: verify relationship belongs to this user before deleting
      await prisma.contactRelationship.deleteMany({
        where: {
          id: relationshipId,
          userId: locals.user.id
        }
      });
    } catch (err) {
      console.error('[removeRelationship] failed:', err);
      return fail(500, { error: 'Failed to remove relationship' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  }

};
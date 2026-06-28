// src/routes/contacts/[id]/+page.server.ts
// PURPOSE: Load contact details, notes, relationships, reminders, and attached deals.
// SECURITY: All reads and writes are tenant scoped by userId.

import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { fail, redirect } from '@sveltejs/kit';
import { attachContactTags, detachContactTag } from '$lib/tags';
import type { Actions, PageServerLoad } from './$types';
import { getBestDisplayName } from '$lib/server/names';
import {
  DEAL_RELATIONSHIP_TYPES,
  dealRelationshipLabel,
  dealStatusLabel,
  formatDealValue,
  normaliseDealRelationshipType,
  safeDecrypt
} from '$lib/deals';

function isPlaceholderName(name: string | null | undefined): boolean {
  const s = (name || '').trim().toLowerCase();
  return !s || s === 'new connection' || s === 'relish user';
}

async function decryptContactName(row: { fullNameEnc: string | null; linkedUserId?: string | null }) {
  let name = '';
  try {
    name = row.fullNameEnc ? decrypt(row.fullNameEnc, 'contact.full_name') : '';
  } catch {
    name = '';
  }

  if (row.linkedUserId && isPlaceholderName(name)) {
    try {
      name = await getBestDisplayName(row.linkedUserId);
    } catch {
      // IT: use fallback below if profile lookup fails.
    }
  }

  return name || 'Relish user';
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const id = params.id;

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
      relationshipsAsA: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          isDirectional: true,
          contactB: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      },
      relationshipsAsB: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          isDirectional: true,
          contactA: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      },
      dealLinks: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          notesEnc: true,
          isPrimary: true,
          deal: {
            select: {
              id: true,
              titleEnc: true,
              valueCents: true,
              currency: true,
              status: true,
              probability: true,
              expectedCloseDate: true,
              updatedAt: true
            }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }]
      }
    }
  });

  if (!row) throw redirect(303, '/');

  const name = await decryptContactName(row);
  let email: string | null = null;
  let phone: string | null = null;
  let company: string | null = null;
  let position: string | null = null;
  let linkedin: string | null = null;

  try { email = row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : null; } catch {}
  try { phone = row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : null; } catch {}
  try { company = row.companyEnc ? decrypt(row.companyEnc, 'contact.company') : null; } catch {}
  try { position = row.positionEnc ? decrypt(row.positionEnc, 'contact.position') : null; } catch {}
  try { linkedin = row.linkedinEnc ? decrypt(row.linkedinEnc, 'contact.linkedin') : null; } catch {}

  const tags = row.tags.map((ct: any) => ({ name: ct.tag.name, slug: ct.tag.slug }));

  const relationships = [];

  for (const rel of row.relationshipsAsA) {
    relationships.push({
      id: rel.id,
      otherContactId: rel.contactB.id,
      otherContactName: await decryptContactName(rel.contactB),
      type: rel.relationshipType,
      label: rel.label || 'knows',
      isDirectional: rel.isDirectional,
      direction: 'outgoing' as const
    });
  }

  for (const rel of row.relationshipsAsB) {
    relationships.push({
      id: rel.id,
      otherContactId: rel.contactA.id,
      otherContactName: await decryptContactName(rel.contactA),
      type: rel.relationshipType,
      label: rel.label || 'knows',
      isDirectional: rel.isDirectional,
      direction: 'incoming' as const
    });
  }

  const deals = row.dealLinks.map((link: any) => ({
    id: link.deal.id,
    linkId: link.id,
    title: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
    status: link.deal.status,
    statusLabel: dealStatusLabel(link.deal.status),
    probability: link.deal.probability,
    valueLabel: formatDealValue(link.deal.valueCents, link.deal.currency),
    expectedCloseDate: link.deal.expectedCloseDate,
    relationshipType: link.relationshipType,
    relationshipLabel: dealRelationshipLabel(link.relationshipType, link.label),
    label: link.label || '',
    notes: safeDecrypt(link.notesEnc, 'deal_contact.notes', ''),
    isPrimary: link.isPrimary,
    updatedAt: link.deal.updatedAt
  }));

  const interactionsRaw = await prisma.interaction.findMany({
    where: { userId: locals.user.id, contactId: id },
    select: { id: true, channel: true, occurredAt: true, rawTextEnc: true },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 50
  });

  const interactions = interactionsRaw.map((it: any) => {
    let text = '';
    try { text = it.rawTextEnc ? decrypt(it.rawTextEnc, 'interaction.raw_text') : ''; } catch {}
    const preview = text.length > 280 ? text.slice(0, 277) + '...' : text;
    return { id: it.id, channel: it.channel, occurredAt: it.occurredAt, preview, tags: [] };
  });

  const reminders = await prisma.reminder.findMany({
    where: { userId: locals.user.id, contactId: id, completedAt: null },
    select: { id: true, dueAt: true, note: true },
    orderBy: { dueAt: 'asc' }
  });

  const allContacts = await prisma.contact.findMany({
    where: { userId: locals.user.id, id: { not: id } },
    select: { id: true, fullNameEnc: true, linkedUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  const contactOptions = await Promise.all(
    allContacts.map(async (c: any) => ({ id: c.id, name: await decryptContactName(c) }))
  );

  const attachedDealIds = row.dealLinks.map((link: any) => link.deal.id);
  const availableDeals = await prisma.deal.findMany({
    where: { userId: locals.user.id, id: { notIn: attachedDealIds } },
    select: { id: true, titleEnc: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });

  const dealOptions = availableDeals.map((deal: any) => ({
    id: deal.id,
    title: safeDecrypt(deal.titleEnc, 'deal.title', 'Untitled deal'),
    statusLabel: dealStatusLabel(deal.status)
  }));

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
    relationships,
    contactOptions,
    deals,
    dealOptions,
    dealRelationshipOptions: DEAL_RELATIONSHIP_TYPES,
    interactions,
    reminders
  };
};

export const actions: Actions = {
  addTag: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const raw = String(form.get('name') ?? form.get('tag') ?? '').trim();
    if (!raw) return fail(400, { error: 'Missing tag name.' });

    const names = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);

    try {
      await attachContactTags({ userId: locals.user.id, contactId: params.id, names, provenance: 'user' });
    } catch (e: any) {
      console.error('[contacts:addTag] attachContactTags failed', { contactId: params.id, message: e?.message, code: e?.code });
      return fail(500, { error: 'Failed to add tag.' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  removeTag: async ({ request, params, locals }) => {
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

    throw redirect(303, `/contacts/${params.id}`);
  },

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
      if (!res.count) return fail(404, { error: 'Contact not found for this user' });
    } catch (e) {
      console.error('[contacts:setCadence] failed', e);
      return fail(500, { error: 'Failed to update cadence' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  markContactedToday: async ({ locals, params }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    try {
      await prisma.contact.updateMany({
        where: { id: params.id, userId: locals.user.id },
        data: { lastContactedAt: new Date() }
      });
    } catch (e) {
      console.error('[contacts:markContactedToday] failed', { contactId: params.id, err: e });
      return fail(500, { error: 'Failed to mark contacted' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  createReminder: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const dueAtRaw = String(form.get('dueAt') ?? '').trim();
    const note = String(form.get('note') ?? '').trim();
    if (!dueAtRaw) return fail(400, { error: 'Due date is required' });

    const dueAt = new Date(dueAtRaw);
    if (Number.isNaN(dueAt.getTime())) return fail(400, { error: 'Invalid due date' });

    const exists = await prisma.contact.findFirst({ where: { id: params.id, userId: locals.user.id }, select: { id: true } });
    if (!exists) return fail(404, { error: 'Contact not found' });

    try {
      await prisma.reminder.create({ data: { userId: locals.user.id, contactId: params.id, dueAt, note: note || null } });
    } catch (e) {
      console.error('[contacts:createReminder] failed', { contactId: params.id, err: e });
      return fail(500, { error: 'Failed to create reminder' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

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

  deleteReminder: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const reminderId = String(form.get('reminderId') ?? '').trim();
    if (!reminderId) return fail(400, { error: 'Missing reminder id' });

    try {
      const res = await prisma.reminder.deleteMany({ where: { id: reminderId, userId: locals.user.id, contactId: params.id } });
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

    if (!otherContactId) return fail(400, { error: 'Please select a contact' });

    const [contactA, contactB] = await Promise.all([
      prisma.contact.findFirst({ where: { id: params.id, userId: locals.user.id }, select: { id: true } }),
      prisma.contact.findFirst({ where: { id: otherContactId, userId: locals.user.id }, select: { id: true } })
    ]);

    if (!contactA || !contactB) return fail(404, { error: 'Contact not found' });

    try {
      await prisma.contactRelationship.create({
        data: { userId: locals.user.id, contactAId: params.id, contactBId: otherContactId, label, isDirectional: false }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'This relationship already exists' });
      console.error('[contacts:addRelationship] failed', err);
      return fail(500, { error: 'Failed to add relationship' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  removeRelationship: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const relationshipId = String(form.get('relationshipId') || '').trim();
    if (!relationshipId) return fail(400, { error: 'Missing relationship ID' });

    try {
      await prisma.contactRelationship.deleteMany({ where: { id: relationshipId, userId: locals.user.id } });
    } catch (err) {
      console.error('[contacts:removeRelationship] failed', err);
      return fail(500, { error: 'Failed to remove relationship' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  addDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const userId = locals.user.id;
    const form = await request.formData();
    const dealId = String(form.get('dealId') || '').trim();
    const relationshipType = normaliseDealRelationshipType(form.get('relationshipType'));
    const label = String(form.get('label') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    if (!dealId) return fail(400, { error: 'Please select a deal.' });

    const [contact, deal] = await Promise.all([
      prisma.contact.findFirst({ where: { id: params.id, userId }, select: { id: true } }),
      prisma.deal.findFirst({ where: { id: dealId, userId }, select: { id: true } })
    ]);

    if (!contact || !deal) return fail(404, { error: 'Contact or deal not found.' });

    try {
      await prisma.$transaction(async (tx: any) => {
        if (isPrimary) {
          await tx.dealContact.updateMany({
            where: { userId, dealId, isPrimary: true },
            data: { isPrimary: false }
          });
        }

        await tx.dealContact.create({
          data: {
            userId,
            dealId,
            contactId: params.id,
            relationshipType: relationshipType as any,
            label: label || (relationshipType ? null : 'connected'),
            notesEnc: notes ? encrypt(notes, 'deal_contact.notes') : null,
            isPrimary
          }
        });
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'This contact is already attached to that deal with the same label.' });
      console.error('[contacts:addDeal] failed', { message: err?.message, code: err?.code });
      return fail(500, { error: 'Failed to attach deal.' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  },

  removeDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing deal relationship id.' });

    try {
      await prisma.dealContact.deleteMany({ where: { id: linkId, userId: locals.user.id, contactId: params.id } });
    } catch (err) {
      console.error('[contacts:removeDeal] failed', err);
      return fail(500, { error: 'Failed to remove deal relationship.' });
    }

    throw redirect(303, `/contacts/${params.id}`);
  }
};

// src/routes/deals/[id]/+page.server.ts
// PURPOSE: Show a deal, update deal state, and manage the contacts involved.
// SECURITY: Every read and write is scoped by userId.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import {
  DEAL_RELATIONSHIP_TYPES,
  DEAL_STATUSES,
  centsToInputValue,
  dateToInputValue,
  dealRelationshipLabel,
  dealStatusLabel,
  formatDealValue,
  isClosedDealStatus,
  normaliseDealRelationshipType,
  normaliseDealStatus,
  parseMoneyToCents,
  parseOptionalDate,
  parseProbability,
  safeDecrypt,
  weightedValueCents
} from '$lib/deals';

async function ensureOwnedDeal(userId: string, dealId: string) {
  return prisma.deal.findFirst({
    where: { id: dealId, userId },
    select: { id: true, status: true }
  });
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await prisma.deal.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      valueCents: true,
      currency: true,
      status: true,
      probability: true,
      expectedCloseDate: true,
      closedAt: true,
      lostReasonEnc: true,
      createdAt: true,
      updatedAt: true,
      contacts: {
        select: {
          id: true,
          contactId: true,
          relationshipType: true,
          label: true,
          notesEnc: true,
          isPrimary: true,
          createdAt: true,
          contact: {
            select: {
              id: true,
              fullNameEnc: true,
              emailEnc: true,
              phoneEnc: true,
              companyEnc: true,
              linkedUserId: true
            }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    }
  });

  if (!row) throw redirect(303, '/deals');

  const people = await Promise.all(
    row.contacts.map(async (link: any) => ({
      id: link.id,
      contactId: link.contactId,
      name: await contactDisplayName(link.contact),
      company: safeDecrypt(link.contact.companyEnc, 'contact.company', ''),
      email: safeDecrypt(link.contact.emailEnc, 'contact.email', ''),
      phone: safeDecrypt(link.contact.phoneEnc, 'contact.phone', ''),
      relationshipType: link.relationshipType,
      relationshipLabel: dealRelationshipLabel(link.relationshipType, link.label),
      label: link.label || '',
      notes: safeDecrypt(link.notesEnc, 'deal_contact.notes', ''),
      isPrimary: link.isPrimary,
      createdAt: link.createdAt
    }))
  );

  const attachedContactIds = new Set(row.contacts.map((link: any) => link.contactId));
  const availableContactsRaw = await prisma.contact.findMany({
    where: { userId: locals.user.id, id: { notIn: [...attachedContactIds] } },
    select: { id: true, fullNameEnc: true, linkedUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 300
  });

  const notesRaw = await prisma.dealNote.findMany({
    where: { userId: locals.user.id, dealId: row.id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      summaryEnc: true,
      contact: {
        select: { id: true, fullNameEnc: true, linkedUserId: true }
      }
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 30
  });

  const notes = await Promise.all(
    notesRaw.map(async (note: any) => {
      const rawText = safeDecrypt(note.rawTextEnc, 'deal_note.raw_text', '');
      const summary = safeDecrypt(note.summaryEnc, 'deal_note.summary', '');
      const previewSource = summary || rawText;
      const preview = previewSource.length > 320 ? previewSource.slice(0, 317) + '...' : previewSource;
      return {
        id: note.id,
        channel: note.channel,
        occurredAt: note.occurredAt,
        preview,
        summary,
        contactId: note.contact?.id || null,
        contactName: note.contact ? await contactDisplayName(note.contact) : ''
      };
    })
  );

  const weighted = weightedValueCents(row.valueCents, row.probability);

  return {
    deal: {
      id: row.id,
      title: safeDecrypt(row.titleEnc, 'deal.title', 'Untitled deal'),
      description: safeDecrypt(row.descriptionEnc, 'deal.description', ''),
      valueCents: row.valueCents,
      valueInput: centsToInputValue(row.valueCents),
      valueLabel: formatDealValue(row.valueCents, row.currency),
      weightedValueLabel: weighted === null ? 'No weighted value' : formatDealValue(weighted, row.currency),
      currency: row.currency,
      status: row.status,
      statusLabel: dealStatusLabel(row.status),
      probability: row.probability,
      expectedCloseDate: row.expectedCloseDate,
      expectedCloseDateInput: dateToInputValue(row.expectedCloseDate),
      closedAt: row.closedAt,
      lostReason: safeDecrypt(row.lostReasonEnc, 'deal.lost_reason', ''),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    },
    people,
    notes,
    contactOptions: await contactOptionsForRows(availableContactsRaw),
    statusOptions: DEAL_STATUSES,
    relationshipOptions: DEAL_RELATIONSHIP_TYPES
  };
};

export const actions: Actions = {
  updateState: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const owned = await ensureOwnedDeal(locals.user.id, params.id);
    if (!owned) return fail(404, { error: 'Deal not found.' });

    const form = await request.formData();
    const status = normaliseDealStatus(form.get('status'));
    const probability = parseProbability(form.get('probability'));
    const valueCents = parseMoneyToCents(form.get('value'));
    const currency = String(form.get('currency') || 'AUD').trim().toUpperCase().slice(0, 3) || 'AUD';
    const expectedCloseDate = parseOptionalDate(form.get('expectedCloseDate'));
    const lostReason = String(form.get('lostReason') || '').trim();

    try {
      await prisma.deal.updateMany({
        where: { id: params.id, userId: locals.user.id },
        data: {
          status: status as any,
          probability,
          valueCents,
          currency,
          expectedCloseDate,
          closedAt: isClosedDealStatus(status) ? new Date() : null,
          lostReasonEnc: status === 'LOST' && lostReason ? encrypt(lostReason, 'deal.lost_reason') : null
        }
      });
    } catch (err) {
      console.error('[deals:updateState] failed', err);
      return fail(500, { error: 'Could not update deal state.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },

  addContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const userId = locals.user.id;
    const form = await request.formData();
    const contactId = String(form.get('contactId') || '').trim();
    const relationshipType = normaliseDealRelationshipType(form.get('relationshipType'));
    const label = String(form.get('label') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    if (!contactId) return fail(400, { error: 'Please select a contact.' });

    const [deal, contact] = await Promise.all([
      ensureOwnedDeal(userId, params.id),
      prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } })
    ]);

    if (!deal || !contact) return fail(404, { error: 'Deal or contact not found.' });

    try {
      await prisma.$transaction(async (tx: any) => {
        if (isPrimary) {
          await tx.dealContact.updateMany({
            where: { userId, dealId: params.id, isPrimary: true },
            data: { isPrimary: false }
          });
        }

        await tx.dealContact.create({
          data: {
            userId,
            dealId: params.id,
            contactId,
            relationshipType: relationshipType as any,
            label: label || (relationshipType ? null : 'connected'),
            notesEnc: notes ? encrypt(notes, 'deal_contact.notes') : null,
            isPrimary
          }
        });
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'That contact already has that role on this deal.' });
      console.error('[deals:addContact] failed', { message: err?.message, code: err?.code });
      return fail(500, { error: 'Could not add contact to deal.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },

  removeContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const userId = locals.user.id;
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing relationship id.' });

    try {
      await prisma.dealContact.deleteMany({
        where: { id: linkId, userId, dealId: params.id }
      });
    } catch (err) {
      console.error('[deals:removeContact] failed', err);
      return fail(500, { error: 'Could not remove contact from deal.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },

  makePrimary: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const userId = locals.user.id;
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing relationship id.' });

    try {
      await prisma.$transaction([
        prisma.dealContact.updateMany({
          where: { userId, dealId: params.id, isPrimary: true },
          data: { isPrimary: false }
        }),
        prisma.dealContact.updateMany({
          where: { id: linkId, userId, dealId: params.id },
          data: { isPrimary: true }
        })
      ]);
    } catch (err) {
      console.error('[deals:makePrimary] failed', err);
      return fail(500, { error: 'Could not update primary contact.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  }
};

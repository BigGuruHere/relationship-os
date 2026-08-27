// src/routes/deals/new/+page.server.ts
// PURPOSE: Create a relationship-driven deal with an optional first contact link.
// SECURITY: Tenant scoped by locals.user.id and encrypted fields are written server side.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { contactOptionsForRows } from '$lib/server/contactDisplay';
import {
  DEAL_RELATIONSHIP_TYPES,
  DEAL_STATUSES,
  defaultProbabilityForStatus,
  normaliseDealRelationshipType,
  normaliseDealStatus,
  commercialValueInputError,
  parseMoneyToCents,
  parseOptionalDate,
  parseProbability
} from '$lib/deals';
import { projectStatusLabel, safeDecryptTask } from '$lib/tasks';

async function loadContactOptions(userId: string) {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: { id: true, fullNameEnc: true, linkedUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 300
  });
  return contactOptionsForRows(contacts);
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const projectId = String(url.searchParams.get('projectId') || '').trim();
  const selectedProject = projectId
    ? await prisma.project.findFirst({ where: { id: projectId, userId: locals.user.id }, select: { id: true, titleEnc: true, status: true } })
    : null;

  return {
    statusOptions: DEAL_STATUSES,
    relationshipOptions: DEAL_RELATIONSHIP_TYPES,
    contactOptions: await loadContactOptions(locals.user.id),
    selectedProject: selectedProject ? {
      id: selectedProject.id,
      title: safeDecryptTask(selectedProject.titleEnc, 'project.title', 'Untitled project'),
      statusLabel: projectStatusLabel(selectedProject.status)
    } : null
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    const description = String(form.get('description') || '').trim();
    const descriptionSummary = String(form.get('descriptionSummary') || '').trim();
    const initialNoteChannel = String(form.get('initialNoteChannel') || 'note').trim() || 'note';
    const currency = String(form.get('currency') || 'AUD').trim().toUpperCase().slice(0, 3) || 'AUD';
    const status = normaliseDealStatus(form.get('status'));
    const probability = parseProbability(form.get('probability')) ?? defaultProbabilityForStatus(status);
    const valueRaw = String(form.get('value') || '').trim();
    const valueCents = parseMoneyToCents(valueRaw);
    const expectedCloseDate = parseOptionalDate(form.get('expectedCloseDate'));
    const firstContactId = String(form.get('firstContactId') || '').trim();
    const projectId = String(form.get('projectId') || '').trim();
    const relationshipType = normaliseDealRelationshipType(form.get('relationshipType'));
    const label = String(form.get('label') || '').trim() || null;

    const values = {
      title,
      description,
      descriptionSummary,
      initialNoteChannel,
      currency,
      status,
      probability,
      value: valueRaw,
      expectedCloseDate: String(form.get('expectedCloseDate') || '').trim(),
      firstContactId,
      projectId,
      relationshipType: relationshipType || '',
      label: label || ''
    };

    if (!title) {
      return fail(400, { error: 'Deal title is required.', values });
    }

    const valueError = commercialValueInputError(valueRaw);
    if (valueError) return fail(400, { error: `Estimated value: ${valueError}`, values });

    const duplicateDeal = await prisma.deal.findFirst({ where: { userId: locals.user.id, titleIdx: buildIndexToken(title) }, select: { id: true } });
    if (duplicateDeal) return fail(409, { error: 'A deal with this title already exists.', values });

    if (firstContactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: firstContactId, userId: locals.user.id },
        select: { id: true }
      });
      if (!contact) return fail(404, { error: 'Selected contact was not found.', values });
    }

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: locals.user.id },
        select: { id: true }
      });
      if (!project) return fail(404, { error: 'Selected project was not found.', values });
    }

    let dealId = '';
    try {
      const created = await prisma.deal.create({
        data: {
          userId: locals.user.id,
          titleEnc: encrypt(title, 'deal.title'),
          titleIdx: buildIndexToken(title),
          descriptionEnc: description ? encrypt(description, 'deal.description') : null,
          descriptionSummaryEnc: descriptionSummary ? encrypt(descriptionSummary, 'deal.description_summary') : null,
          currency,
          status: status as any,
          probability,
          valueCents,
          expectedCloseDate,
          closedAt: status === 'WON' || status === 'LOST' ? new Date() : null,
          contacts: firstContactId
            ? {
                create: {
                  userId: locals.user.id,
                  contactId: firstContactId,
                  relationshipType: relationshipType as any,
                  label: label || (relationshipType ? null : 'connected'),
                  isPrimary: true
                }
              }
            : undefined,
          // IT: Turn the initial create-page notes into the first deal note as well,
          // so voice-transcribed setup context appears in the normal deal notes timeline.
          notes: description
            ? {
                create: {
                  userId: locals.user.id,
                  contactId: firstContactId || null,
                  channel: initialNoteChannel,
                  rawTextEnc: encrypt(description, 'deal_note.raw_text'),
                  summaryEnc: descriptionSummary ? encrypt(descriptionSummary, 'deal_note.summary') : null
                }
              }
            : undefined
        },
        select: { id: true }
      });
      dealId = created.id;
      if (projectId) {
        await prisma.projectDeal.create({ data: { userId: locals.user.id, projectId, dealId: created.id } }).catch(() => null);
      }
    } catch (err: any) {
      console.error('[deals:new] create failed', { message: err?.message, code: err?.code });
      return fail(500, { error: 'Could not create deal.', values });
    }

    throw redirect(303, `/deals/${dealId}`);
  }
};

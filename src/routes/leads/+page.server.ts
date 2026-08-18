// src/routes/leads/+page.server.ts
// PURPOSE: Stage 6 market lead list and create form.
// SECURITY: All reads/writes are scoped to locals.user.id. Lead details are encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import {
  COMMUNICATION_METHODS,
  BUYER_QUALIFICATION_STATUSES,
  CONTACT_ATTEMPT_STATUSES,
  MARKET_LEAD_SOURCES,
  MARKET_LEAD_STATUSES,
  MARKET_LEAD_TYPES,
  SELLER_QUALIFICATION_STATUSES
} from '$lib/marketLeads';
import { buildLeadSourceOptions, leadFormValues, loadLeadSources, mapMarketLead, marketLeadCreateData, normaliseLeadSourceChoice, resolveLeadSourceId } from '$lib/server/marketLeads';
import { safeDecryptTask } from '$lib/tasks';

const LIMIT = 250;

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const q = String(url.searchParams.get('q') || '').trim();
  const type = String(url.searchParams.get('type') || '').trim().toUpperCase();
  const status = String(url.searchParams.get('status') || '').trim().toUpperCase();
  const selectedSource = String(url.searchParams.get('source') || '').trim();
  const contactAttemptStatus = String(url.searchParams.get('contactAttemptStatus') || '').trim().toUpperCase();
  const buyerStatus = String(url.searchParams.get('buyerStatus') || '').trim().toUpperCase();
  const sellerStatus = String(url.searchParams.get('sellerStatus') || '').trim().toUpperCase();

  const customLeadSources = await loadLeadSources(userId);

  const where: any = { userId };
  if (type && MARKET_LEAD_TYPES.some((o) => o.value === type)) where.type = type;
  if (status && MARKET_LEAD_STATUSES.some((o) => o.value === status)) where.status = status;
  if (contactAttemptStatus && CONTACT_ATTEMPT_STATUSES.some((o) => o.value === contactAttemptStatus)) where.contactAttemptStatus = contactAttemptStatus;
  if (buyerStatus && BUYER_QUALIFICATION_STATUSES.some((o) => o.value === buyerStatus)) where.buyerStatus = buyerStatus;
  if (sellerStatus && SELLER_QUALIFICATION_STATUSES.some((o) => o.value === sellerStatus)) where.sellerStatus = sellerStatus;
  const sourceFilter = normaliseLeadSourceChoice(selectedSource);
  if (sourceFilter.kind === 'builtin' && MARKET_LEAD_SOURCES.some((o) => o.value === sourceFilter.source)) where.source = sourceFilter.source;
  if (sourceFilter.kind === 'custom' && customLeadSources.some((source) => source.id === sourceFilter.id)) where.leadSourceId = sourceFilter.id;

  const [rows, projectsRaw] = await Promise.all([
    prisma.marketLead.findMany({
    where,
    select: {
      id: true,
      titleEnc: true,
      nameEnc: true,
      companyNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      websiteEnc: true,
      linkedinEnc: true,
      roleTitleEnc: true,
      geographyEnc: true,
      addressEnc: true,
      descriptionEnc: true,
      notesEnc: true,
      sourceUrlEnc: true,
      nextActionEnc: true,
      type: true,
      status: true,
      source: true,
      leadSourceId: true,
      leadSource: { select: { id: true, nameEnc: true } },
      usualCommunicationMethod: true,
      contactAttemptStatus: true,
      lastContactedAt: true,
      buyerStatus: true,
      sellerStatus: true,
      confidence: true,
      priority: true,
      valueMinCents: true,
      valueMaxCents: true,
      currency: true,
      contactId: true,
      companyId: true,
      dealId: true,
      projectId: true,
      exchangeItemId: true,
      convertedAt: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    take: LIMIT
    }),
    prisma.project.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, titleEnc: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 200
    })
  ]);

  const projects = projectsRaw.map((project: any) => ({ id: project.id, title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'), status: project.status }));

  const qLower = q.toLowerCase();
  const leads = rows.map(mapMarketLead).filter((lead) => {
    if (!q) return true;
    return [lead.title, lead.name, lead.companyName, lead.email, lead.phone, lead.website, lead.linkedin, lead.roleTitle, lead.geography, lead.address, lead.description, lead.notes, lead.typeLabel, lead.statusLabel, lead.sourceLabel, lead.sourceCategoryLabel, lead.contactAttemptStatusLabel, lead.buyerStatusLabel, lead.sellerStatusLabel]
      .join(' ')
      .toLowerCase()
      .includes(qLower);
  });

  const counts = await prisma.marketLead.groupBy({ by: ['status'], where: { userId }, _count: { status: true } });
  const summary = {
    total: counts.reduce((sum: number, row: any) => sum + row._count.status, 0),
    newCount: counts.find((row: any) => row.status === 'NEW')?._count.status || 0,
    qualified: counts.find((row: any) => row.status === 'QUALIFIED')?._count.status || 0,
    converted: counts.find((row: any) => row.status === 'CONVERTED')?._count.status || 0
  };

  return {
    q,
    selectedType: type,
    selectedStatus: status,
    selectedSource,
    selectedContactAttemptStatus: contactAttemptStatus,
    selectedBuyerStatus: buyerStatus,
    selectedSellerStatus: sellerStatus,
    leads,
    summary,
    leadTypes: MARKET_LEAD_TYPES,
    leadStatuses: MARKET_LEAD_STATUSES,
    leadSourceOptions: buildLeadSourceOptions(customLeadSources),
    contactAttemptStatuses: CONTACT_ATTEMPT_STATUSES,
    buyerQualificationStatuses: BUYER_QUALIFICATION_STATUSES,
    sellerQualificationStatuses: SELLER_QUALIFICATION_STATUSES,
    communicationMethods: COMMUNICATION_METHODS,
    projects
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const values = leadFormValues(form);
    if (!values.title && !values.name && !values.companyName) {
      return fail(400, { error: 'Add at least a lead title, person name, or company name.', values });
    }

    try {
      values.leadSourceId = (await resolveLeadSourceId(locals.user.id, values.leadSourceId, values.newLeadSource)) || '';
      if (values.projectId) {
        const projectOk = await prisma.project.findFirst({ where: { id: values.projectId, userId: locals.user.id }, select: { id: true } });
        if (!projectOk) return fail(404, { error: 'Selected project was not found.', values });
      }
      const created = await prisma.marketLead.create({ data: marketLeadCreateData(locals.user.id, values) as any, select: { id: true } });
      throw redirect(303, `/leads/${created.id}`);
    } catch (err: any) {
      if (err?.status) throw err;
      console.error('[leads:create] failed', err);
      return fail(500, { error: 'Could not create lead.', values });
    }
  }
};

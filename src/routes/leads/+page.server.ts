// src/routes/leads/+page.server.ts
// PURPOSE: Stage 6 market lead list and create form.
// SECURITY: All reads/writes are scoped to locals.user.id. Lead details are encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import {
  COMMUNICATION_METHODS,
  MARKET_LEAD_SOURCES,
  MARKET_LEAD_STATUSES,
  MARKET_LEAD_TYPES
} from '$lib/marketLeads';
import { leadFormValues, loadLeadSources, mapMarketLead, marketLeadCreateData, resolveLeadSourceId } from '$lib/server/marketLeads';
import { safeDecryptTask } from '$lib/tasks';

const LIMIT = 250;

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const q = String(url.searchParams.get('q') || '').trim();
  const type = String(url.searchParams.get('type') || '').trim().toUpperCase();
  const status = String(url.searchParams.get('status') || '').trim().toUpperCase();

  const where: any = { userId };
  if (type && MARKET_LEAD_TYPES.some((o) => o.value === type)) where.type = type;
  if (status && MARKET_LEAD_STATUSES.some((o) => o.value === status)) where.status = status;

  const [rows, projectsRaw, customLeadSources] = await Promise.all([
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
      addressLine1Enc: true,
      addressLine2Enc: true,
      suburbEnc: true,
      stateEnc: true,
      postcodeEnc: true,
      countryEnc: true,
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
    }),
    loadLeadSources(userId)
  ]);

  const projects = projectsRaw.map((project: any) => ({ id: project.id, title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'), status: project.status }));

  const qLower = q.toLowerCase();
  const leads = rows.map(mapMarketLead).filter((lead) => {
    if (!q) return true;
    return [lead.title, lead.name, lead.companyName, lead.email, lead.phone, lead.website, lead.linkedin, lead.roleTitle, lead.geography, lead.address, lead.description, lead.notes, lead.typeLabel, lead.statusLabel]
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
    leads,
    summary,
    leadTypes: MARKET_LEAD_TYPES,
    leadStatuses: MARKET_LEAD_STATUSES,
    leadSourceCategories: MARKET_LEAD_SOURCES,
    leadSources: customLeadSources,
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

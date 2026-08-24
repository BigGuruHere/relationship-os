// src/routes/offers/+page.server.ts
// PURPOSE: First-class Offer list and create workflow.
// SECURITY: All reads/writes are scoped to locals.user.id. Offer text is encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { safeDecrypt } from '$lib/deals';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { createOfferFromForm, mapOffer, offerSelect } from '$lib/server/offers';
import { OFFER_CONFIDENCES, OFFER_DIRECTIONS, OFFER_STATUSES, OFFER_TIME_HORIZONS, OFFER_TYPES, OFFER_URGENCIES } from '$lib/offers';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  const selectedStatus = String(url.searchParams.get('status') || '').trim().toUpperCase();
  const selectedType = String(url.searchParams.get('offerType') || '').trim().toUpperCase();
  const selectedProjectId = String(url.searchParams.get('projectId') || '').trim();
  const selectedWorkstreamId = String(url.searchParams.get('workstreamId') || '').trim();

  const where: any = { userId };
  if (selectedStatus && OFFER_STATUSES.some((o) => o.value === selectedStatus)) where.status = selectedStatus;
  else where.status = { not: 'ARCHIVED' as any };
  if (selectedType && OFFER_TYPES.some((o) => o.value === selectedType)) where.offerType = selectedType;
  if (selectedProjectId) where.projectId = selectedProjectId;
  if (selectedWorkstreamId) where.workstreamId = selectedWorkstreamId;

  const [rows, projectsRaw, workstreamsRaw, contactsRaw, companiesRaw, dealsRaw, counts] = await Promise.all([
    prisma.offer.findMany({ where, select: offerSelect, orderBy: [{ status: 'asc' }, { importance: 'desc' }, { updatedAt: 'desc' }], take: 300 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.projectWorkstream.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, projectId: true, project: { select: { titleEnc: true } } }, orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }], take: 300 }),
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.offer.groupBy({ by: ['status'], where: { userId }, _count: { status: true } })
  ]);

  let offers = rows.map(mapOffer);
  if (q) {
    offers = offers.filter((offer) => [offer.title, offer.description, offer.terms, offer.category, offer.geography, offer.offerTypeLabel, offer.statusLabel, offer.contact?.name, offer.company?.name, offer.project?.title, offer.workstream?.name].join(' ').toLowerCase().includes(q));
  }

  const openCount = counts.filter((row: any) => !['ARCHIVED', 'CLOSED_INACTIVE', 'CONVERTED_TO_DEAL'].includes(String(row.status))).reduce((sum: number, row: any) => sum + row._count.status, 0);
  const summary = {
    openCount,
    available: counts.find((row: any) => row.status === 'AVAILABLE')?._count.status || 0,
    watching: counts.find((row: any) => row.status === 'WATCHING_INTEREST')?._count.status || 0,
    matched: counts.find((row: any) => row.status === 'MATCHED')?._count.status || 0
  };

  return {
    offers,
    q,
    selectedStatus,
    selectedType,
    selectedProjectId,
    selectedWorkstreamId,
    summary,
    offerTypes: OFFER_TYPES,
    offerStatuses: OFFER_STATUSES,
    offerUrgencies: OFFER_URGENCIES,
    offerTimeHorizons: OFFER_TIME_HORIZONS,
    offerConfidences: OFFER_CONFIDENCES,
    offerDirections: OFFER_DIRECTIONS,
    projects: projectsRaw.map((p: any) => ({ id: p.id, title: safeDecrypt(p.titleEnc, 'project.title', 'Untitled project') })),
    workstreams: workstreamsRaw.map((ws: any) => ({ id: ws.id, projectId: ws.projectId, name: safeDecrypt(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectTitle: safeDecrypt(ws.project?.titleEnc, 'project.title', 'Untitled project') })),
    contacts: await Promise.all(contactsRaw.map(async (c: any) => ({ id: c.id, name: await contactDisplayName(c) }))),
    companies: companiesRaw.map((c: any) => ({ id: c.id, name: safeDecrypt(c.nameEnc, 'company.name', 'Untitled company') })),
    deals: dealsRaw.map((d: any) => ({ id: d.id, title: safeDecrypt(d.titleEnc, 'deal.title', 'Untitled deal'), status: d.status }))
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const offer = await createOfferFromForm({ userId: locals.user.id, form: await request.formData() });
      throw redirect(303, `/offers/${offer.id}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not create offer.' });
    }
  }
};

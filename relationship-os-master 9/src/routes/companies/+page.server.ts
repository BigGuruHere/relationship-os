// src/routes/companies/+page.server.ts
// PURPOSE: List and create first-class company records for broker workflows.
// SECURITY: All reads/writes are scoped to locals.user.id and company fields are encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import {
  COMPANY_KINDS,
  COMPANY_STATUSES,
  companyKindLabel,
  companyStatusLabel,
  normaliseCompanyKind,
  normaliseCompanyStatus,
  safeDecryptCompany
} from '$lib/companies';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const q = String(url.searchParams.get('q') || '').trim();
  const status = String(url.searchParams.get('status') || '').trim().toUpperCase();
  const kind = String(url.searchParams.get('kind') || '').trim().toUpperCase();

  const where: any = { userId };
  if (status && COMPANY_STATUSES.some((s) => s.value === status)) where.status = status;
  if (kind && COMPANY_KINDS.some((k) => k.value === kind)) where.kind = kind;

  const rows = await prisma.company.findMany({
    where,
    select: {
      id: true,
      nameEnc: true,
      websiteEnc: true,
      industryEnc: true,
      locationEnc: true,
      descriptionEnc: true,
      kind: true,
      status: true,
      updatedAt: true,
      _count: { select: { contacts: true, dealLinks: true, tasks: true } }
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 300
  });

  const companies = rows.map((row: any) => {
    const name = safeDecryptCompany(row.nameEnc, 'company.name', 'Untitled company');
    const website = safeDecryptCompany(row.websiteEnc, 'company.website', '');
    const industry = safeDecryptCompany(row.industryEnc, 'company.industry', '');
    const location = safeDecryptCompany(row.locationEnc, 'company.location', '');
    const description = safeDecryptCompany(row.descriptionEnc, 'company.description', '');
    return {
      id: row.id,
      name,
      website,
      industry,
      location,
      description: description.length > 180 ? `${description.slice(0, 177)}...` : description,
      kind: row.kind,
      kindLabel: companyKindLabel(row.kind),
      status: row.status,
      statusLabel: companyStatusLabel(row.status),
      contactCount: row._count?.contacts || 0,
      dealCount: row._count?.dealLinks || 0,
      taskCount: row._count?.tasks || 0,
      updatedAt: row.updatedAt
    };
  }).filter((company) => {
    if (!q) return true;
    const haystack = [company.name, company.website, company.industry, company.location, company.description, company.kindLabel, company.statusLabel].join(' ').toLowerCase();
    return haystack.includes(q.toLowerCase());
  });

  return {
    q,
    selectedStatus: status,
    selectedKind: kind,
    companies,
    companyKinds: COMPANY_KINDS,
    companyStatuses: COMPANY_STATUSES
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    if (!name) return fail(400, { error: 'Company name is required.' });

    const website = String(form.get('website') || '').trim();
    const industry = String(form.get('industry') || '').trim();
    const location = String(form.get('location') || '').trim();
    const description = String(form.get('description') || '').trim();
    const criteria = String(form.get('criteria') || '').trim();
    const notes = String(form.get('notes') || '').trim();

    try {
      const created = await prisma.company.create({
        data: {
          userId,
          nameEnc: encrypt(name, 'company.name'),
          nameIdx: buildIndexToken(name),
          websiteEnc: website ? encrypt(website, 'company.website') : null,
          websiteIdx: website ? buildIndexToken(website) : null,
          industryEnc: industry ? encrypt(industry, 'company.industry') : null,
          locationEnc: location ? encrypt(location, 'company.location') : null,
          descriptionEnc: description ? encrypt(description, 'company.description') : null,
          criteriaEnc: criteria ? encrypt(criteria, 'company.criteria') : null,
          notesEnc: notes ? encrypt(notes, 'company.notes') : null,
          kind: normaliseCompanyKind(form.get('kind')) as any,
          status: normaliseCompanyStatus(form.get('status')) as any
        },
        select: { id: true }
      });
      throw redirect(303, `/companies/${created.id}`);
    } catch (err: any) {
      if (err?.status) throw err;
      if (err?.code === 'P2002') return fail(409, { error: 'You already have a company with this name.' });
      console.error('[companies:create] failed', err);
      return fail(500, { error: 'Could not create company.' });
    }
  },

  updateStatus: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const companyId = String(form.get('companyId') || '').trim();
    if (!companyId) return fail(400, { error: 'Missing company id.' });

    await prisma.company.updateMany({
      where: { id: companyId, userId: locals.user.id },
      data: { status: normaliseCompanyStatus(form.get('status')) as any }
    });
    throw redirect(303, '/companies');
  }
};

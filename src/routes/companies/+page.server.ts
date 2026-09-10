// src/routes/companies/+page.server.ts
// PURPOSE: List and create first-class company records for broker workflows.
// SECURITY: All reads/writes are scoped to locals.user.id and company fields are encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { resolveOrCreateTagForTenant } from '$lib/tags';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';
import { decryptCompanyExternalIdentifier } from '$lib/server/leadImport';
import {
  COMPANY_EXTERNAL_IDENTIFIER_SCHEMES,
  areCompanyNamesSimilarForDuplicateWarning,
  companyIdentifierComparisonKey,
  normaliseCompanyIdentifierScheme,
  normaliseCompanyIdentifierValue,
  normaliseCompanyNameForDuplicateWarning
} from '$lib/companyIdentity';
import {
  COMPANY_KINDS,
  COMPANY_STATUSES,
  companyKindLabel,
  companyStatusLabel,
  normaliseCompanyKind,
  normaliseCompanyStatus,
  safeDecryptCompany
} from '$lib/companies';

function uniqById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function companyDuplicateSummary(row: any, matchReasons: string[]) {
  return {
    id: row.id,
    label: safeDecryptCompany(row.nameEnc, 'company.name', 'Untitled company'),
    website: safeDecryptCompany(row.websiteEnc, 'company.website', ''),
    phone: safeDecryptCompany(row.phoneEnc, 'company.phone', ''),
    industry: safeDecryptCompany(row.industryEnc, 'company.industry', ''),
    location: safeDecryptCompany(row.locationEnc, 'company.location', ''),
    href: `/companies/${row.id}`,
    matchReasons
  };
}

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
      phoneEnc: true,
      industryEnc: true,
      locationEnc: true,
      descriptionEnc: true,
      kind: true,
      status: true,
      updatedAt: true,
      tags: { select: { tag: { select: { name: true } } }, take: 12 },
      _count: { select: { contacts: true, dealLinks: true, tasks: true } }
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 300
  });

  const companies = rows.map((row: any) => {
    const name = safeDecryptCompany(row.nameEnc, 'company.name', 'Untitled company');
    const website = safeDecryptCompany(row.websiteEnc, 'company.website', '');
    const phone = safeDecryptCompany(row.phoneEnc, 'company.phone', '');
    const industry = safeDecryptCompany(row.industryEnc, 'company.industry', '');
    const location = safeDecryptCompany(row.locationEnc, 'company.location', '');
    const description = safeDecryptCompany(row.descriptionEnc, 'company.description', '');
    return {
      id: row.id,
      name,
      website,
      phone,
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
      tags: (row.tags || []).map((ct: any) => ct.tag.name),
      updatedAt: row.updatedAt
    };
  }).filter((company) => {
    if (!q) return true;
    const haystack = [company.name, company.website, company.phone, company.industry, company.location, company.description, company.kindLabel, company.statusLabel, ...(company.tags || [])].join(' ').toLowerCase();
    return haystack.includes(q.toLowerCase());
  });

  return {
    q,
    selectedStatus: status,
    selectedKind: kind,
    companies,
    companyKinds: COMPANY_KINDS,
    companyStatuses: COMPANY_STATUSES,
    companyExternalIdentifierSchemes: COMPANY_EXTERNAL_IDENTIFIER_SCHEMES
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const contextSpaceId = contextSpaceIdForOwner(userId);
    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    const website = String(form.get('website') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const tagsInput = String(form.get('tags') || '').trim();
    const industry = String(form.get('industry') || '').trim();
    const location = String(form.get('location') || '').trim();
    const description = String(form.get('description') || '').trim();
    const criteria = String(form.get('criteria') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    const kind = normaliseCompanyKind(form.get('kind')) as any;
    const status = normaliseCompanyStatus(form.get('status')) as any;
    const forceCreate = String(form.get('forceCreate') || '') === '1';
    const identifierScheme = normaliseCompanyIdentifierScheme(form.get('identifierScheme'));
    const identifierValue = normaliseCompanyIdentifierValue(form.get('identifierValue'));
    const identifierSourceUrl = String(form.get('identifierSourceUrl') || '').trim();

    const values = { name, website, phone, tags: tagsInput, industry, location, description, criteria, notes, kind, status, identifierScheme, identifierValue, identifierSourceUrl };

    if ((identifierScheme && !identifierValue) || (!identifierScheme && identifierValue)) {
      return fail(400, { error: 'Add both an identifier type and identifier value, or leave both blank.', values });
    }

    if (!name) return fail(400, { error: 'Company name is required.', values });

    const duplicateSelect = {
      id: true,
      nameEnc: true,
      websiteEnc: true,
      phoneEnc: true,
      industryEnc: true,
      locationEnc: true
    } as const;

    // IT: An exact external identifier is authoritative when present. It is optional, so Companies
    // without a register id still use name/phone/website warnings and remain valid records.
    if (identifierScheme && identifierValue) {
      const comparisonKey = companyIdentifierComparisonKey(identifierScheme, identifierValue);
      let identifierMatch = await (prisma as any).companyExternalIdentifier.findFirst({
        where: { userId, contextSpaceId, scheme: identifierScheme, valueIdx: buildIndexToken(identifierValue) },
        select: { id: true, valueEnc: true, company: { select: duplicateSelect } }
      });
      // IT: ABNs/ACNs are often formatted with or without spaces. The exact HMAC lookup stays fast,
      // then this small compatibility scan catches formatting-only differences in older/manual data.
      if (!identifierMatch && (identifierScheme === 'ABN' || identifierScheme === 'ACN')) {
        const candidates = await (prisma as any).companyExternalIdentifier.findMany({
          where: { userId, contextSpaceId, scheme: identifierScheme },
          select: { id: true, valueEnc: true, company: { select: duplicateSelect } },
          take: 1000
        });
        identifierMatch = candidates.find((candidate: any) =>
          companyIdentifierComparisonKey(identifierScheme, decryptCompanyExternalIdentifier(candidate.valueEnc, '')) === comparisonKey
        ) || null;
      }
      if (identifierMatch?.company) {
        return fail(409, {
          values,
          duplicateWarning: {
            title: 'Company identifier already exists',
            message: 'This identifier is already attached to an existing Company. Open that Company rather than creating another one.',
            matches: [companyDuplicateSummary(identifierMatch.company, [`same ${identifierScheme} identifier`])],
            allowCreateAnyway: false
          }
        });
      }
    }

    const [sameNameRows, samePhoneRows, sameWebsiteRows, recentNameRows] = await Promise.all([
      prisma.company.findMany({ where: { userId, contextSpaceId, nameIdx: buildIndexToken(name) }, select: duplicateSelect, take: 6, orderBy: { updatedAt: 'desc' } }),
      phone ? prisma.company.findMany({ where: { userId, contextSpaceId, phoneIdx: buildIndexToken(phone) }, select: duplicateSelect, take: 6, orderBy: { updatedAt: 'desc' } }) : Promise.resolve([]),
      website ? prisma.company.findMany({ where: { userId, contextSpaceId, websiteIdx: buildIndexToken(website) }, select: duplicateSelect, take: 6, orderBy: { updatedAt: 'desc' } }) : Promise.resolve([]),
      prisma.company.findMany({ where: { userId, contextSpaceId }, select: duplicateSelect, take: 750, orderBy: { updatedAt: 'desc' } })
    ]);

    const matchReasonsById = new Map<string, Set<string>>();
    for (const row of sameNameRows) matchReasonsById.set(row.id, new Set([...(matchReasonsById.get(row.id) || []), 'same company name']));
    for (const row of samePhoneRows) matchReasonsById.set(row.id, new Set([...(matchReasonsById.get(row.id) || []), 'same phone']));
    for (const row of sameWebsiteRows) matchReasonsById.set(row.id, new Set([...(matchReasonsById.get(row.id) || []), 'same website']));

    const normalisedName = normaliseCompanyNameForDuplicateWarning(name);
    const similarNameRows = normalisedName
      ? recentNameRows.filter((row: any) => {
          if (sameNameRows.some((same: any) => same.id === row.id)) return false;
          const existingName = safeDecryptCompany(row.nameEnc, 'company.name', '');
          // IT: Fuzzy name matching is warning-only. It must never merge or block a Company.
          return areCompanyNamesSimilarForDuplicateWarning(existingName, name);
        }).slice(0, 6)
      : [];
    for (const row of similarNameRows) matchReasonsById.set(row.id, new Set([...(matchReasonsById.get(row.id) || []), 'similar company name']));

    const duplicateRows = uniqById([...sameNameRows, ...samePhoneRows, ...sameWebsiteRows, ...similarNameRows]);
    if (!forceCreate && duplicateRows.length > 0) {
      return fail(409, {
        values,
        duplicateWarning: {
          title: 'Possible duplicate company found',
          message: 'Review the existing company before creating a new one. Same or similar company names are allowed, but this helps avoid accidental duplicates.',
          matches: duplicateRows.map((row) => companyDuplicateSummary(row, Array.from(matchReasonsById.get(row.id) || []))),
          allowCreateAnyway: true
        }
      });
    }

    try {
      const created = await prisma.$transaction(async (tx: any) => {
        const company = await tx.company.create({
          data: {
            userId,
            contextSpaceId,
            nameEnc: encrypt(name, 'company.name'),
            nameIdx: buildIndexToken(name),
            websiteEnc: website ? encrypt(website, 'company.website') : null,
            websiteIdx: website ? buildIndexToken(website) : null,
            phoneEnc: phone ? encrypt(phone, 'company.phone') : null,
            phoneIdx: phone ? buildIndexToken(phone) : null,
            industryEnc: industry ? encrypt(industry, 'company.industry') : null,
            locationEnc: location ? encrypt(location, 'company.location') : null,
            descriptionEnc: description ? encrypt(description, 'company.description') : null,
            criteriaEnc: criteria ? encrypt(criteria, 'company.criteria') : null,
            notesEnc: notes ? encrypt(notes, 'company.notes') : null,
            kind,
            status
          },
          select: { id: true }
        });

        if (identifierScheme && identifierValue) {
          await tx.companyExternalIdentifier.create({
            data: {
              userId,
              contextSpaceId,
              companyId: company.id,
              scheme: identifierScheme,
              valueEnc: encrypt(identifierValue, 'company_external_identifier.value'),
              valueIdx: buildIndexToken(identifierValue),
              sourceUrlEnc: identifierSourceUrl ? encrypt(identifierSourceUrl, 'company_external_identifier.source_url') : null
            }
          });
        }
        return company;
      });

      const tagNames = tagsInput.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12);
      for (const tagName of tagNames) {
        const tag = await resolveOrCreateTagForTenant(userId, tagName, 'user');
        await prisma.companyTag.upsert({
          where: { companyId_tagId: { companyId: created.id, tagId: tag.id } },
          update: {},
          create: { userId, contextSpaceId, companyId: created.id, tagId: tag.id, assignedBy: 'user' as any }
        });
      }

      throw redirect(303, `/companies/${created.id}`);
    } catch (err: any) {
      if (err?.status) throw err;
      if (err?.code === 'P2002') return fail(409, { error: 'A company already uses one of these unique details.', values });
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

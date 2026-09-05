// PURPOSE: Import a deliberately selected CSV slice into the existing MarketLead workflow.
// SECURITY: The server reparses the uploaded file, validates all mapped columns and keeps every write in the active Workspace custody.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { parseCsv, valueForHeader } from '$lib/csv';
import { MARKET_LEAD_STATUSES, MARKET_LEAD_TYPES } from '$lib/marketLeads';
import { resolveLeadSourceId } from '$lib/server/marketLeads';
import { importSelectedLeadBatch } from '$lib/server/leadImport';
import { normaliseExternalScheme, type LeadImportRow } from '$lib/leadImport';
import { safeDecryptTask } from '$lib/tasks';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;

const mappingFields = [
  'mapCompanyName',
  'mapExternalCode',
  'mapCompanyPhone',
  'mapWebsite',
  'mapGeography',
  'mapPersonName',
  'mapRoleTitle',
  'mapEmail',
  'mapPhone',
  'mapResearch',
  'mapResearchProvider',
  'mapResearchDate',
  'mapSourceUrl'
] as const;

type MappingField = (typeof mappingFields)[number];

function readMapping(form: FormData) {
  return Object.fromEntries(mappingFields.map((field) => [field, String(form.get(field) || '').trim()])) as Record<MappingField, string>;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const [projectsRaw, workstreamsRaw] = await Promise.all([
    prisma.project.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, titleEnc: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 200
    }),
    prisma.projectWorkstream.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, nameEnc: true, projectId: true, project: { select: { titleEnc: true } } },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 300
    })
  ]);

  return {
    projects: projectsRaw.map((project: any) => ({
      id: project.id,
      title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project')
    })),
    workstreams: workstreamsRaw.map((ws: any) => ({
      id: ws.id,
      projectId: ws.projectId,
      name: safeDecryptTask(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'),
      projectTitle: safeDecryptTask(ws.project?.titleEnc, 'project.title', 'Untitled project')
    })),
    leadTypes: MARKET_LEAD_TYPES,
    leadStatuses: MARKET_LEAD_STATUSES
  };
};

export const actions: Actions = {
  import: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const file = form.get('file');
    const batchName = String(form.get('batchName') || '').trim();
    const externalScheme = normaliseExternalScheme(String(form.get('externalScheme') || ''));
    const projectIdInput = String(form.get('projectId') || '').trim();
    const workstreamId = String(form.get('workstreamId') || '').trim();
    const tags = String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    const leadType = String(form.get('leadType') || 'COMPANY').trim().toUpperCase();
    const leadStatus = String(form.get('leadStatus') || 'NOT_CONTACTED').trim().toUpperCase();
    const priority = Math.min(5, Math.max(1, Number.parseInt(String(form.get('priority') || '3'), 10) || 3));
    const mapping = readMapping(form);

    if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'Choose a CSV file to import.' });
    if (file.size > MAX_FILE_BYTES) return fail(400, { error: 'CSV is too large. Keep this first-stage import under 10 MB.' });
    if (!batchName) return fail(400, { error: 'Give this calling batch a name.' });
    if (!externalScheme) return fail(400, { error: 'Enter an external identifier scheme, for example ASQA_RTO or AGED_CARE_PROVIDER.' });
    if (!MARKET_LEAD_TYPES.some((option) => option.value === leadType)) return fail(400, { error: 'Invalid lead type.' });
    if (!MARKET_LEAD_STATUSES.some((option) => option.value === leadStatus)) return fail(400, { error: 'Invalid lead status.' });

    let table;
    try {
      table = parseCsv(await file.text());
    } catch (err: any) {
      return fail(400, { error: String(err?.message || 'Could not parse CSV.') });
    }
    if (table.headers.length === 0 || table.rows.length === 0) return fail(400, { error: 'CSV has no data rows.' });
    if (table.rows.length > MAX_IMPORT_ROWS) return fail(400, { error: `This first import flow accepts up to ${MAX_IMPORT_ROWS} rows at once. Upload only the hot slice you intend to work.` });

    for (const required of ['mapCompanyName', 'mapExternalCode'] as const) {
      if (!mapping[required] || !table.headers.includes(mapping[required])) {
        return fail(400, { error: required === 'mapCompanyName' ? 'Map the company-name column.' : 'Map the external registration/reference code column.' });
      }
    }
    for (const [field, header] of Object.entries(mapping)) {
      if (header && !table.headers.includes(header)) return fail(400, { error: `Mapped column ${header} for ${field} was not found in the uploaded CSV.` });
    }

    let projectId = projectIdInput || null;
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
      if (!project) return fail(404, { error: 'Selected project was not found.' });
    }
    if (workstreamId) {
      const workstream = await prisma.projectWorkstream.findFirst({ where: { id: workstreamId, userId }, select: { id: true, projectId: true } });
      if (!workstream) return fail(404, { error: 'Selected workstream was not found.' });
      projectId = projectId || workstream.projectId;
      if (projectId !== workstream.projectId) return fail(400, { error: 'Selected workstream belongs to a different project.' });
    }

    const rows: LeadImportRow[] = table.rows.map((row, index) => ({
      rowNumber: index + 2,
      companyName: valueForHeader(table.headers, row, mapping.mapCompanyName),
      externalCode: valueForHeader(table.headers, row, mapping.mapExternalCode),
      companyPhone: valueForHeader(table.headers, row, mapping.mapCompanyPhone),
      website: valueForHeader(table.headers, row, mapping.mapWebsite),
      geography: valueForHeader(table.headers, row, mapping.mapGeography),
      personName: valueForHeader(table.headers, row, mapping.mapPersonName),
      roleTitle: valueForHeader(table.headers, row, mapping.mapRoleTitle),
      email: valueForHeader(table.headers, row, mapping.mapEmail),
      phone: valueForHeader(table.headers, row, mapping.mapPhone),
      research: valueForHeader(table.headers, row, mapping.mapResearch),
      researchProvider: valueForHeader(table.headers, row, mapping.mapResearchProvider),
      researchDate: valueForHeader(table.headers, row, mapping.mapResearchDate),
      sourceUrl: valueForHeader(table.headers, row, mapping.mapSourceUrl)
    }));

    // IT: LeadSource doubles as the first-stage calling-list/batch label. The existing Leads page
    // can filter directly by this custom source without adding another list abstraction yet.
    const leadSourceId = await resolveLeadSourceId(userId, '', batchName);
    if (!leadSourceId) return fail(500, { error: 'Could not create or resolve the import batch source.' });

    try {
      const result = await importSelectedLeadBatch({
        userId,
        batchName,
        sourceFileName: file.name,
        leadSourceId,
        externalScheme,
        projectId,
        workstreamId: workstreamId || null,
        tags,
        leadType,
        leadStatus,
        priority,
        rows
      });

      return {
        success: true,
        result,
        batchUrl: `/leads?source=${encodeURIComponent(`custom:${leadSourceId}`)}`
      };
    } catch (err: any) {
      console.error('[lead-import] failed', err);
      return fail(500, { error: String(err?.message || 'Lead import failed.') });
    }
  }
};

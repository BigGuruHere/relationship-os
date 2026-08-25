// src/routes/projects/[id]/workstreams/[workstreamId]/+page.server.ts
// PURPOSE: Work inside one project workstream - leads, tasks, notes and linked deals.
// SECURITY: Every read/write is tenant scoped by locals.user.id and the parent project id.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { safeDecrypt } from '$lib/deals';
import { companyDisplay } from '$lib/companies';
import {
  MARKET_LEAD_STATUSES,
  MARKET_LEAD_TYPES,
  marketLeadStatusLabel,
  marketLeadTypeLabel
} from '$lib/marketLeads';
import {
  buildLeadSourceOptions,
  leadFormValues,
  loadLeadSources,
  mapMarketLead,
  marketLeadCreateData,
  resolveLeadSourceId
} from '$lib/server/marketLeads';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import { createTaskFromForm } from '$lib/server/tasks';
import { createWantFromForm, deleteWant, loadWants } from '$lib/server/wants';
import { createOfferFromForm, deleteOffer, loadOffers } from '$lib/server/offers';
import {
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  normaliseTaskStatus,
  parseDateTime,
  safeDecryptTask,
  taskFocusLabel,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

const ACTIVE_TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];
const returnTo = (projectId: string, workstreamId: string) => `/projects/${projectId}/workstreams/${workstreamId}`;

function workstreamDisplay(row: any) {
  return {
    id: row.id,
    name: safeDecryptTask(row.nameEnc, 'project_workstream.name', 'Untitled workstream'),
    description: safeDecryptTask(row.descriptionEnc, 'project_workstream.description', ''),
    status: row.status,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function projectDisplay(row: any) {
  return {
    id: row.id,
    title: safeDecryptTask(row.titleEnc, 'project.title', 'Untitled project'),
    description: safeDecryptTask(row.descriptionEnc, 'project.description', ''),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function marketLeadSelect() {
  return {
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
    nextActionAt: true,
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
    workstreamId: true,
    workstream: { select: { id: true, nameEnc: true, projectId: true, status: true } },
    exchangeItemId: true,
    convertedAt: true,
    createdAt: true,
    updatedAt: true
  };
}

async function assertProjectAndWorkstream(userId: string, projectId: string, workstreamId: string) {
  const [project, workstream] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true, titleEnc: true, descriptionEnc: true, status: true, createdAt: true, updatedAt: true } }),
    prisma.projectWorkstream.findFirst({
      where: { id: workstreamId, userId, projectId },
      select: { id: true, nameEnc: true, descriptionEnc: true, status: true, sortOrder: true, createdAt: true, updatedAt: true }
    })
  ]);
  if (!project) throw redirect(303, '/projects');
  if (!workstream) throw redirect(303, `/projects/${projectId}`);
  return { project, workstream };
}

async function loadOptions(userId: string, projectId: string, workstreamId: string, projectTitle: string) {
  const [contactsRaw, companiesRaw, dealsRaw, workstreamLeadsRaw, attachableLeadsRaw, linkedProjectDealsRaw, leadSourcesRaw, workstreamsRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, kind: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.marketLead.findMany({ where: { userId, projectId, workstreamId, status: { notIn: ['ARCHIVED', 'CONVERTED'] as any } }, select: { id: true, titleEnc: true, type: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.marketLead.findMany({ where: { userId, status: { notIn: ['ARCHIVED', 'CONVERTED'] as any }, OR: [{ projectId: null }, { projectId }] }, select: { id: true, titleEnc: true, type: true, status: true, projectId: true, workstreamId: true, project: { select: { id: true, titleEnc: true } }, workstream: { select: { id: true, nameEnc: true } } }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.projectDeal.findMany({ where: { userId, projectId }, select: { dealId: true }, take: 500 }),
    loadLeadSources(userId),
    // IT: sibling workstreams in this same project - createTask locks projectId but not
    // workstreamId, so the TasksPanel picker offers every workstream a task could legally move to.
    prisma.projectWorkstream.findMany({
      where: { userId, projectId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, nameEnc: true },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 300
    })
  ]);

  const contacts = await contactOptionsForRows(contactsRaw as any);
  const companies = companiesRaw.map((company: any) => ({ id: company.id, name: companyDisplay(company), kind: company.kind, status: company.status }));
  const workstreams = workstreamsRaw.map((ws: any) => ({ id: ws.id, name: safeDecryptTask(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectId, projectTitle }));
  const linkedDealIds = new Set(linkedProjectDealsRaw.map((row: any) => row.dealId));
  const deals = dealsRaw.map((deal: any) => ({ id: deal.id, title: safeDecrypt(deal.titleEnc, 'deal.title', 'Untitled deal'), status: deal.status }));
  const unlinkedDeals = deals.filter((deal: any) => !linkedDealIds.has(deal.id));
  const workstreamLeads = workstreamLeadsRaw.map((lead: any) => ({ id: lead.id, title: safeDecryptTask(lead.titleEnc, 'market_lead.title', 'Untitled lead'), type: lead.type, typeLabel: marketLeadTypeLabel(lead.type), status: lead.status, statusLabel: marketLeadStatusLabel(lead.status) }));
  const attachableLeads = attachableLeadsRaw
    .filter((lead: any) => lead.workstreamId !== workstreamId)
    .map((lead: any) => ({ id: lead.id, title: safeDecryptTask(lead.titleEnc, 'market_lead.title', 'Untitled lead'), type: lead.type, typeLabel: marketLeadTypeLabel(lead.type), status: lead.status, statusLabel: marketLeadStatusLabel(lead.status), projectId: lead.projectId, workstreamId: lead.workstreamId, projectTitle: lead.project ? safeDecryptTask(lead.project.titleEnc, 'project.title', 'Untitled project') : '', workstreamName: lead.workstream ? safeDecryptTask(lead.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream') : '' }));

  return {
    contacts,
    companies,
    deals,
    unlinkedDeals,
    workstreamLeads,
    attachableLeads,
    workstreams,
    leadSources: buildLeadSourceOptions(leadSourcesRaw)
  };
}

async function findPossibleLeadDuplicates(userId: string, values: any) {
  const or: any[] = [];
  const title = values.title || values.name || values.companyName || '';
  const candidates = [
    { field: 'titleIdx', value: title },
    { field: 'nameIdx', value: values.name },
    { field: 'companyNameIdx', value: values.companyName },
    { field: 'emailIdx', value: values.email },
    { field: 'phoneIdx', value: values.phone }
  ];
  for (const item of candidates) {
    const value = String(item.value || '').trim();
    if (value) or.push({ [item.field]: buildIndexToken(value) });
  }
  if (or.length === 0) return [];
  const rows = await prisma.marketLead.findMany({
    where: { userId, status: { notIn: ['ARCHIVED'] as any }, OR: or },
    select: {
      id: true,
      titleEnc: true,
      nameEnc: true,
      companyNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      type: true,
      status: true,
      project: { select: { id: true, titleEnc: true } },
      workstream: { select: { id: true, nameEnc: true } },
      updatedAt: true
    },
    orderBy: { updatedAt: 'desc' },
    take: 8
  });
  return rows.map((row: any) => ({
    id: row.id,
    title: safeDecryptTask(row.titleEnc, 'market_lead.title', 'Untitled lead'),
    name: safeDecryptTask(row.nameEnc, 'market_lead.name', ''),
    companyName: safeDecryptTask(row.companyNameEnc, 'market_lead.company_name', ''),
    email: safeDecryptTask(row.emailEnc, 'market_lead.email', ''),
    phone: safeDecryptTask(row.phoneEnc, 'market_lead.phone', ''),
    type: row.type,
    typeLabel: marketLeadTypeLabel(row.type),
    status: row.status,
    statusLabel: marketLeadStatusLabel(row.status),
    project: row.project ? { id: row.project.id, title: safeDecryptTask(row.project.titleEnc, 'project.title', 'Untitled project') } : null,
    workstream: row.workstream ? { id: row.workstream.id, name: safeDecryptTask(row.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream') } : null,
    updatedAt: row.updatedAt
  }));
}

function serialiseLeadValues(values: any) {
  return {
    title: values.title || '',
    type: values.type || 'OTHER',
    status: values.status || 'NEW',
    sourceChoice: values.sourceChoice || '',
    source: values.source || 'MANUAL',
    leadSourceId: values.leadSourceId || '',
    newLeadSource: values.newLeadSource || '',
    name: values.name || '',
    companyName: values.companyName || '',
    email: values.email || '',
    phone: values.phone || '',
    website: values.website || '',
    linkedin: values.linkedin || '',
    roleTitle: values.roleTitle || '',
    geography: values.geography || '',
    address: values.address || '',
    description: values.description || '',
    notes: values.notes || '',
    sourceUrl: values.sourceUrl || '',
    usualCommunicationMethod: values.usualCommunicationMethod || '',
    contactAttemptStatus: values.contactAttemptStatus || 'NOT_CONTACTED',
    lastContactedAt: values.lastContactedAt || '',
    buyerStatus: values.buyerStatus || 'NOT_ASKED',
    sellerStatus: values.sellerStatus || 'NOT_ASKED',
    confidence: values.confidence ?? 50,
    priority: values.priority ?? 3,
    valueMin: values.valueMin || '',
    valueMax: values.valueMax || '',
    currency: values.currency || 'AUD',
    nextAction: values.nextAction || '',
    nextActionAt: values.nextActionAt || ''
  };
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const projectId = params.id;
  const workstreamId = params.workstreamId;
  const { project, workstream } = await assertProjectAndWorkstream(userId, projectId, workstreamId);

  const [leadsRaw, tasksRaw, notesRaw, dealsRaw, wants, offers, options] = await Promise.all([
    prisma.marketLead.findMany({
      where: { userId, projectId, workstreamId, status: { notIn: ['ARCHIVED', 'CONVERTED'] as any } },
      select: marketLeadSelect() as any,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 300
    }),
    prisma.task.findMany({
      where: { userId, projectId, workstreamId },
      select: {
        id: true,
        titleEnc: true,
        notesEnc: true,
        summaryEnc: true,
        status: true,
        urgency: true,
        importance: true,
        focus: true,
        taskType: true,
        dueAt: true,
        snoozedUntil: true,
        completedAt: true,
        updatedAt: true,
        marketLead: { select: { id: true, titleEnc: true, type: true, status: true } },
        contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
        assignedToContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
        waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
        deal: { select: { id: true, titleEnc: true, status: true } },
        company: { select: { id: true, nameEnc: true, kind: true, status: true } }
      },
      orderBy: [{ focus: 'asc' }, { status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 300
    }),
    prisma.projectNote.findMany({
      where: { userId, projectId, workstreamId },
      select: { id: true, bodyEnc: true, summaryEnc: true, channel: true, occurredAt: true, createdAt: true, updatedAt: true },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 120
    }),
    prisma.projectDeal.findMany({
      where: { userId, projectId, workstreamId },
      select: { id: true, labelEnc: true, notesEnc: true, createdAt: true, deal: { select: { id: true, titleEnc: true, status: true, valueCents: true, currency: true, probability: true, updatedAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    }),
    loadWants({ userId, links: { projectId, workstreamId }, take: 100 }),
    loadOffers({ userId, links: { projectId, workstreamId }, take: 100 }),
    loadOptions(userId, projectId, workstreamId, safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'))
  ]);

  const leads = leadsRaw.map(mapMarketLead);
  const tasks = await Promise.all(tasksRaw.map(async (task: any) => ({
    id: task.id,
    title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
    notes: safeDecryptTask(task.notesEnc, 'task.notes', ''),
    summary: safeDecryptTask(task.summaryEnc, 'task.summary', ''),
    status: task.status,
    statusLabel: taskStatusLabel(task.status),
    urgency: task.urgency,
    urgencyLabel: taskUrgencyLabel(task.urgency),
    importance: task.importance,
    importanceLabel: taskImportanceLabel(task.importance),
    focus: task.focus,
    focusLabel: taskFocusLabel(task.focus),
    taskType: task.taskType,
    taskTypeLabel: taskTypeLabel(task.taskType),
    dueAt: task.dueAt,
    snoozedUntil: task.snoozedUntil,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt,
    marketLead: task.marketLead ? { id: task.marketLead.id, title: safeDecryptTask(task.marketLead.titleEnc, 'market_lead.title', 'Untitled lead'), type: task.marketLead.type, status: task.marketLead.status } : null,
    contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
    assignedToContact: task.assignedToContact ? { id: task.assignedToContact.id, name: await contactDisplayName(task.assignedToContact) } : null,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
    deal: task.deal ? { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal'), status: task.deal.status } : null,
    company: task.company ? { id: task.company.id, name: companyDisplay(task.company), status: task.company.status } : null
  })));
  const notes = notesRaw.map((note: any) => ({
    id: note.id,
    body: safeDecryptTask(note.bodyEnc, 'project_note.body', ''),
    summary: safeDecryptTask(note.summaryEnc, 'project_note.summary', ''),
    channel: note.channel || 'note',
    occurredAt: note.occurredAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  }));
  const deals = dealsRaw.map((link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    title: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
    status: link.deal.status,
    valueCents: link.deal.valueCents,
    currency: link.deal.currency,
    probability: link.deal.probability,
    label: safeDecryptTask(link.labelEnc, 'project_deal.label', ''),
    notes: safeDecryptTask(link.notesEnc, 'project_deal.notes', ''),
    createdAt: link.createdAt,
    updatedAt: link.deal.updatedAt
  }));

  // IT: full canonical picker option lists for TasksPanel - see src/lib/TasksPanel.svelte. Scoped
  // to the deals already linked to this workstream, keeping the pickers relevant rather than
  // dumping every deal-thread in the account onto one workstream's quick-add form.
  const workstreamDealIds = deals.map((d: any) => d.dealId);
  const [taskDealContactsRaw, taskDealCompaniesRaw] = await Promise.all([
    workstreamDealIds.length
      ? prisma.dealContact.findMany({
          where: { userId, dealId: { in: workstreamDealIds } },
          select: { id: true, label: true, deal: { select: { id: true, titleEnc: true } }, contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 200
        })
      : Promise.resolve([]),
    workstreamDealIds.length
      ? prisma.dealCompany.findMany({
          where: { userId, dealId: { in: workstreamDealIds } },
          select: { id: true, label: true, deal: { select: { id: true, titleEnc: true } }, company: { select: { id: true, nameEnc: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 200
        })
      : Promise.resolve([])
  ]);
  const taskDealContactOptions = await Promise.all(taskDealContactsRaw.map(async (link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${await contactDisplayName(link.contact)}${link.label ? ` (${link.label})` : ''}`
  })));
  const taskDealCompanyOptions = taskDealCompaniesRaw.map((link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${companyDisplay(link.company)}${link.label ? ` (${link.label})` : ''}`
  }));

  const now = new Date();
  const summary = {
    leads: leads.length,
    tasks: tasks.length,
    openTasks: tasks.filter((task: any) => ACTIVE_TASK_STATUSES.includes(task.status)).length,
    overdueTasks: tasks.filter((task: any) => ACTIVE_TASK_STATUSES.includes(task.status) && task.dueAt && new Date(task.dueAt).getTime() < now.getTime()).length,
    deals: deals.length,
    wants: wants.length,
    offers: offers.length,
    notes: notes.length,
    readyLeads: leads.filter((lead: any) => lead.status === 'QUALIFIED').length
  };

  return {
    project: projectDisplay(project),
    workstream: workstreamDisplay(workstream),
    leads,
    tasks,
    notes,
    deals,
    wants,
    offers,
    summary,
    options,
    taskDealContactOptions,
    taskDealCompanyOptions,
    marketLeadTypes: MARKET_LEAD_TYPES,
    marketLeadStatuses: MARKET_LEAD_STATUSES,
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    taskTypes: TASK_TYPES
  };
};

export const actions: Actions = {
  updateWorkstream: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim();
    if (!name) return fail(400, { error: 'Workstream name is required.' });
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);
    await prisma.projectWorkstream.updateMany({
      where: { id: params.workstreamId, userId, projectId: params.id },
      data: { nameEnc: encrypt(name, 'project_workstream.name'), nameIdx: buildIndexToken(name), descriptionEnc: description ? encrypt(description, 'project_workstream.description') : null }
    });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  createLead: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);
    const form = await request.formData();
    const values = leadFormValues(form, { projectId: params.id, workstreamId: params.workstreamId });
    values.projectId = params.id;
    values.workstreamId = params.workstreamId;
    values.leadSourceId = (await resolveLeadSourceId(userId, values.leadSourceId, values.newLeadSource)) || '';
    if (!values.title && !values.name && !values.companyName) return fail(400, { error: 'Add at least a lead title, person name, or company name.' });

    const forceCreate = String(form.get('forceCreate') || '') === '1';
    if (!forceCreate) {
      const duplicates = await findPossibleLeadDuplicates(userId, values);
      if (duplicates.length > 0) {
        return fail(409, {
          error: 'Possible existing lead found. Open the existing lead to check it, or create anyway if this is a different lead.',
          duplicateLeadWarning: true,
          duplicateLeads: duplicates,
          leadValues: serialiseLeadValues(values)
        });
      }
    }

    await prisma.marketLead.create({ data: marketLeadCreateData(userId, values) as any });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  attachLead: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const leadId = String(form.get('leadId') || '').trim();
    if (!leadId) return fail(400, { error: 'Choose a lead to attach.' });
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);
    const lead = await prisma.marketLead.findFirst({ where: { id: leadId, userId, status: { notIn: ['ARCHIVED', 'CONVERTED'] as any } }, select: { id: true, projectId: true } });
    if (!lead) return fail(404, { error: 'Lead not found.' });
    if (lead.projectId && lead.projectId !== params.id) return fail(400, { error: 'Lead already belongs to another project.' });
    await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data: { projectId: params.id, workstreamId: params.workstreamId } });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  createWant: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);
    try {
      await createWantFromForm({
        userId,
        form: await request.formData(),
        links: { projectId: params.id, workstreamId: params.workstreamId }
      });
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Could not create want.' });
    }
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  deleteWant: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const wantId = String(form.get('wantId') || '').trim();
    if (!wantId) return fail(400, { error: 'Missing want id.' });
    await deleteWant({
      userId: locals.user.id,
      id: wantId,
      links: { projectId: params.id, workstreamId: params.workstreamId }
    });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  createOffer: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);
    try {
      await createOfferFromForm({
        userId,
        form: await request.formData(),
        links: { projectId: params.id, workstreamId: params.workstreamId }
      });
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Could not create offer.' });
    }
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  deleteOffer: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const offerId = String(form.get('offerId') || '').trim();
    if (!offerId) return fail(400, { error: 'Missing offer id.' });
    await deleteOffer({
      userId: locals.user.id,
      id: offerId,
      links: { projectId: params.id, workstreamId: params.workstreamId }
    });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);

    // IT: projectId is locked (this page is scoped to one project) but workstreamId is not - the
    // workstream picker defaults to this page's own workstream but is left editable, so a task can
    // be reassigned to a sibling workstream (or none) in the same project. Still fully validated by
    // createTaskFromForm's workstream-must-match-project check below.
    const form = await request.formData();
    const result = await createTaskFromForm(userId, form, {
      projectId: params.id,
      linkProjectDeal: true
    });
    if (!result.ok) return fail(result.status, { error: result.error });

    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  updateTaskStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });
    await prisma.task.updateMany({ where: { id: taskId, userId: locals.user.id, projectId: params.id, workstreamId: params.workstreamId }, data: { status: status as any, completedAt: status === 'DONE' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null } });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  deleteTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    if (!taskId) return fail(400, { error: 'Missing task id.' });
    await prisma.task.deleteMany({ where: { id: taskId, userId: locals.user.id, projectId: params.id, workstreamId: params.workstreamId } });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  createNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);
    const form = await request.formData();
    const body = String(form.get('body') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const channel = String(form.get('channel') || 'note').trim().toLowerCase() || 'note';
    const occurredAt = parseDateTime(form.get('occurredAt')) || new Date();
    if (!body) return fail(400, { error: 'Note body is required.' });
    await prisma.projectNote.create({ data: { userId, projectId: params.id, workstreamId: params.workstreamId, channel, occurredAt, bodyEnc: encrypt(body, 'project_note.body'), summaryEnc: summary ? encrypt(summary, 'project_note.summary') : null } });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  deleteNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const noteId = String(form.get('noteId') || '').trim();
    if (!noteId) return fail(400, { error: 'Missing note id.' });
    await prisma.projectNote.deleteMany({ where: { id: noteId, userId: locals.user.id, projectId: params.id, workstreamId: params.workstreamId } });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  linkDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const dealId = String(form.get('dealId') || '').trim();
    const label = String(form.get('label') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    if (!dealId) return fail(400, { error: 'Choose a deal to link.' });
    await assertProjectAndWorkstream(userId, params.id, params.workstreamId);
    const deal = await prisma.deal.findFirst({ where: { id: dealId, userId }, select: { id: true } });
    if (!deal) return fail(404, { error: 'Deal not found.' });
    await prisma.projectDeal.upsert({
      where: { projectId_dealId: { projectId: params.id, dealId } },
      update: { workstreamId: params.workstreamId, labelEnc: label ? encrypt(label, 'project_deal.label') : undefined, notesEnc: notes ? encrypt(notes, 'project_deal.notes') : undefined },
      create: { userId, projectId: params.id, workstreamId: params.workstreamId, dealId, labelEnc: label ? encrypt(label, 'project_deal.label') : null, notesEnc: notes ? encrypt(notes, 'project_deal.notes') : null }
    });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  },

  removeProjectDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing project-deal link id.' });
    await prisma.projectDeal.deleteMany({ where: { id: linkId, userId: locals.user.id, projectId: params.id, workstreamId: params.workstreamId } });
    throw redirect(303, returnTo(params.id, params.workstreamId));
  }
};

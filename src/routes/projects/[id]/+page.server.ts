// src/routes/projects/[id]/+page.server.ts
// PURPOSE: Project command-centre page showing tasks, leads, notes, wants/offers, and linked market records.
// SECURITY: Every read/write is tenant scoped by locals.user.id. Text fields are encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { companyDisplay } from '$lib/companies';
import { safeDecrypt } from '$lib/deals';
import { MARKET_LEAD_STATUSES, MARKET_LEAD_TYPES, marketLeadStatusLabel } from '$lib/marketLeads';
import { buildLeadSourceOptions, leadFormValues, loadLeadSources, mapMarketLead, marketLeadCreateData, resolveLeadSourceId } from '$lib/server/marketLeads';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import { createExchangeItemFromForm, deleteExchangeItem, loadExchangeItems } from '$lib/server/exchange';
import { loadAgentArtifacts } from '$lib/server/agents/artifacts';
import { createTaskFromForm } from '$lib/server/tasks';
import {
  PROJECT_STATUSES,
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  normaliseProjectStatus,
  normaliseTaskStatus,
  projectStatusLabel,
  safeDecryptTask,
  taskFocusLabel,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

const ACTIVE_TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];

function workstreamDisplay(row: any) {
  if (!row) return null;
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

async function workstreamOk(userId: string, projectId: string, workstreamId: string | null) {
  if (!workstreamId) return true;
  return !!(await prisma.projectWorkstream.findFirst({ where: { id: workstreamId, userId, projectId }, select: { id: true } }));
}

async function loadOptions(userId: string) {
  const [contactsRaw, dealsRaw, companiesRaw, marketLeadsRaw, dealContactsRaw, dealCompaniesRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, kind: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.marketLead.findMany({ where: { userId, status: { notIn: ['ARCHIVED', 'NOT_RELEVANT', 'CONVERTED'] as any } }, select: { id: true, titleEnc: true, type: true, status: true, projectId: true, workstreamId: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.dealContact.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        deal: { select: { id: true, titleEnc: true } },
        contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 300
    }),
    prisma.dealCompany.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        deal: { select: { id: true, titleEnc: true } },
        company: { select: { id: true, nameEnc: true, kind: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 300
    })
  ]);

  const contacts = await contactOptionsForRows(contactsRaw as any);
  const deals = dealsRaw.map((deal) => ({ id: deal.id, title: safeDecrypt(deal.titleEnc, 'deal.title', 'Untitled deal'), status: deal.status }));
  const companies = companiesRaw.map((company) => ({ id: company.id, name: companyDisplay(company), kind: company.kind, status: company.status }));
  const marketLeads = marketLeadsRaw.map((lead: any) => ({
    id: lead.id,
    title: safeDecryptTask(lead.titleEnc, 'market_lead.title', 'Untitled lead'),
    type: lead.type,
    status: lead.status,
    statusLabel: marketLeadStatusLabel(lead.status),
    projectId: lead.projectId,
    workstreamId: lead.workstreamId
  }));
  const dealContacts = await Promise.all(dealContactsRaw.map(async (link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    contactId: link.contact.id,
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${await contactDisplayName(link.contact)}${link.label ? ` (${link.label})` : ''}`
  })));
  const dealCompanies = dealCompaniesRaw.map((link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    companyId: link.company.id,
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${companyDisplay(link.company)}${link.label ? ` (${link.label})` : ''}`
  }));

  return { contacts, deals, companies, marketLeads, dealContacts, dealCompanies };
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

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId },
    select: { id: true, titleEnc: true, descriptionEnc: true, status: true, createdAt: true, updatedAt: true }
  });
  if (!project) throw redirect(303, '/projects');

  const workstreamsRaw = await prisma.projectWorkstream.findMany({
    where: { userId, projectId: project.id, status: { not: 'ARCHIVED' as any } },
    select: { id: true, nameEnc: true, descriptionEnc: true, status: true, sortOrder: true, createdAt: true, updatedAt: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
  const workstreams = workstreamsRaw.map(workstreamDisplay);

  const tasksRaw = await prisma.task.findMany({
    where: { userId, projectId: project.id },
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
      workstream: { select: { id: true, nameEnc: true, status: true } },
      marketLead: { select: { id: true, titleEnc: true, type: true, status: true } },
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      assignedToContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      deal: { select: { id: true, titleEnc: true, status: true } },
      company: { select: { id: true, nameEnc: true, kind: true, status: true } },
      dealCompany: {
        select: {
          id: true,
          dealId: true,
          companyId: true,
          label: true,
          deal: { select: { id: true, titleEnc: true, status: true } },
          company: { select: { id: true, nameEnc: true, kind: true, status: true } }
        }
      },
      dealContact: {
        select: {
          id: true,
          dealId: true,
          contactId: true,
          label: true,
          deal: { select: { id: true, titleEnc: true, status: true } },
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      }
    },
    orderBy: [{ focus: 'asc' }, { status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
    take: 300
  });

  const tasks = await Promise.all(tasksRaw.map(async (task: any) => {
    const dealFromTask = task.deal || task.dealContact?.deal || task.dealCompany?.deal || null;
    const contactFromThread = task.dealContact?.contact || null;
    const companyFromTask = task.company || task.dealCompany?.company || null;
    return {
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      notes: safeDecryptTask(task.notesEnc, 'task.notes', ''),
      summary: safeDecryptTask(task.summaryEnc, 'task.summary', ''),
      status: task.status,
      statusLabel: taskStatusLabel(task.status),
      urgency: task.urgency,
      urgencyLabel: taskUrgencyLabel(task.urgency),
      importanceLabel: taskImportanceLabel(task.importance),
      focus: task.focus,
      focusLabel: taskFocusLabel(task.focus),
      taskTypeLabel: taskTypeLabel(task.taskType),
      dueAt: task.dueAt,
      snoozedUntil: task.snoozedUntil,
      completedAt: task.completedAt,
      updatedAt: task.updatedAt,
      workstream: task.workstream ? { id: task.workstream.id, name: safeDecryptTask(task.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), status: task.workstream.status } : null,
      marketLead: task.marketLead ? { id: task.marketLead.id, title: safeDecryptTask(task.marketLead.titleEnc, 'market_lead.title', 'Untitled lead'), type: task.marketLead.type, status: task.marketLead.status } : null,
      contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
      assignedToContact: task.assignedToContact ? { id: task.assignedToContact.id, name: await contactDisplayName(task.assignedToContact) } : null,
      waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
      deal: dealFromTask ? { id: dealFromTask.id, title: safeDecrypt(dealFromTask.titleEnc, 'deal.title', 'Untitled deal'), status: dealFromTask.status } : null,
      company: companyFromTask ? { id: companyFromTask.id, name: companyDisplay(companyFromTask), status: companyFromTask.status } : null,
      dealContact: task.dealContact ? { id: task.dealContact.id, dealId: task.dealContact.dealId, contactId: task.dealContact.contactId, contactName: await contactDisplayName(contactFromThread) } : null,
      dealCompany: task.dealCompany ? { id: task.dealCompany.id, dealId: task.dealCompany.dealId, companyId: task.dealCompany.companyId, companyName: companyDisplay(task.dealCompany.company) } : null
    };
  }));

  const projectLeadsRaw = await prisma.marketLead.findMany({
    where: { userId, projectId: project.id, status: { notIn: ['ARCHIVED', 'CONVERTED'] as any } },
    select: marketLeadSelect() as any,
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    take: 300
  });
  const projectLeads = projectLeadsRaw.map(mapMarketLead);

  const linkedProjectDealsRaw = await prisma.projectDeal.findMany({
    where: { userId, projectId: project.id },
    select: {
      id: true,
      labelEnc: true,
      notesEnc: true,
      createdAt: true,
      workstream: { select: { id: true, nameEnc: true, status: true } },
      deal: { select: { id: true, titleEnc: true, status: true, valueCents: true, currency: true, probability: true, updatedAt: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  const linkedDeals = linkedProjectDealsRaw.map((link: any) => ({
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
    updatedAt: link.deal.updatedAt,
    workstream: link.workstream ? { id: link.workstream.id, name: safeDecryptTask(link.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), status: link.workstream.status } : null
  }));
  const linkedDealIds = new Set(linkedDeals.map((deal: any) => deal.dealId));

  const exchangeItems = await loadExchangeItems({ userId, links: { projectId: project.id } });
  const agentArtifacts = await loadAgentArtifacts({ userId, entityType: 'project', entityId: project.id });
  const projectNotesRaw = await prisma.projectNote.findMany({
    where: { userId, projectId: project.id },
    select: { id: true, bodyEnc: true, summaryEnc: true, channel: true, occurredAt: true, createdAt: true, updatedAt: true, workstream: { select: { id: true, nameEnc: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 80
  });
  const projectNotes = projectNotesRaw.map((note: any) => ({
    id: note.id,
    body: safeDecryptTask(note.bodyEnc, 'project_note.body', ''),
    summary: safeDecryptTask(note.summaryEnc, 'project_note.summary', ''),
    channel: note.channel || 'note',
    occurredAt: note.occurredAt,
    workstream: note.workstream ? { id: note.workstream.id, name: safeDecryptTask(note.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), status: note.workstream.status } : null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  }));

  const now = new Date();
  const summary = {
    active: tasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length,
    waiting: tasks.filter((task) => task.status === 'WAITING').length,
    overdue: tasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status) && task.dueAt && new Date(task.dueAt).getTime() < now.getTime()).length,
    completed: tasks.filter((task) => task.status === 'DONE').length,
    leads: projectLeads.length,
    readyLeads: projectLeads.filter((lead: any) => lead.status === 'QUALIFIED').length,
    deals: linkedDeals.length,
    workstreams: workstreams.length
  };

  const dealMap = new Map<string, any>();
  const peopleMap = new Map<string, any>();
  const companyMap = new Map<string, any>();
  for (const task of tasks) {
    if (task.deal) dealMap.set(task.deal.id, task.deal);
    if (task.company) companyMap.set(task.company.id, task.company);
    for (const person of [task.contact, task.assignedToContact, task.waitingOnContact]) if (person) peopleMap.set(person.id, person);
    if (task.dealContact) peopleMap.set(task.dealContact.contactId, { id: task.dealContact.contactId, name: task.dealContact.contactName });
    if (task.dealCompany) companyMap.set(task.dealCompany.companyId, { id: task.dealCompany.companyId, name: task.dealCompany.companyName });
  }

  const unassignedSection = { id: '', name: 'Unassigned', status: 'ACTIVE', leads: projectLeads.filter((lead: any) => !lead.workstreamId), tasks: tasks.filter((task: any) => !task.workstream), deals: linkedDeals.filter((deal: any) => !deal.workstream), notes: projectNotes.filter((note: any) => !note.workstream) };
  const workstreamSections = [
    ...workstreams.map((ws: any) => ({
      ...ws,
      leads: projectLeads.filter((lead: any) => lead.workstreamId === ws.id),
      tasks: tasks.filter((task: any) => task.workstream?.id === ws.id),
      deals: linkedDeals.filter((deal: any) => deal.workstream?.id === ws.id),
      notes: projectNotes.filter((note: any) => note.workstream?.id === ws.id)
    })),
    unassignedSection
  ];

  const [options, customLeadSources] = await Promise.all([loadOptions(userId), loadLeadSources(userId)]);

  const projectTitle = safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project');
  // IT: TasksPanel's workstream picker shows "<project title> - <workstream name>" - every
  // workstream here already belongs to this one project (the project picker itself is locked).
  const taskWorkstreamOptions = workstreams.map((ws: any) => ({ id: ws.id, name: ws.name, projectId: project.id, projectTitle }));

  return {
    project: {
      id: project.id,
      title: projectTitle,
      description: safeDecryptTask(project.descriptionEnc, 'project.description', ''),
      status: project.status,
      statusLabel: projectStatusLabel(project.status),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    },
    summary,
    tasks,
    relatedDeals: [...dealMap.values()].filter((deal: any) => !linkedDealIds.has(deal.id)),
    relatedPeople: [...peopleMap.values()],
    relatedCompanies: [...companyMap.values()],
    exchangeItems,
    agentArtifacts,
    projectNotes,
    projectLeads,
    workstreams,
    workstreamSections,
    linkedDeals,
    dealOptionsForLinking: options.deals.filter((deal: any) => !linkedDealIds.has(deal.id)),
    marketLeadTypes: MARKET_LEAD_TYPES,
    marketLeadStatuses: MARKET_LEAD_STATUSES,
    marketLeadSourceOptions: buildLeadSourceOptions(customLeadSources),
    options,
    taskWorkstreamOptions,
    projectStatuses: PROJECT_STATUSES,
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    taskTypes: TASK_TYPES
  };
};

export const actions: Actions = {

  createWorkstream: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim();
    if (!name) return fail(400, { error: 'Workstream name is required.' });
    const project = await prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!project) return fail(404, { error: 'Project not found.' });
    const nameIdx = buildIndexToken(name);
    await prisma.projectWorkstream.upsert({
      where: { projectId_nameIdx: { projectId: params.id, nameIdx } },
      update: { nameEnc: encrypt(name, 'project_workstream.name'), descriptionEnc: description ? encrypt(description, 'project_workstream.description') : null, status: 'ACTIVE' as any },
      create: { userId, projectId: params.id, nameEnc: encrypt(name, 'project_workstream.name'), nameIdx, descriptionEnc: description ? encrypt(description, 'project_workstream.description') : null }
    });
    throw redirect(303, `/projects/${params.id}`);
  },

  archiveWorkstream: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const workstreamId = String(form.get('workstreamId') || '').trim();
    if (!workstreamId) return fail(400, { error: 'Missing workstream id.' });
    const userId = locals.user.id;
    await prisma.$transaction(async (tx: any) => {
      await tx.projectWorkstream.updateMany({ where: { id: workstreamId, userId, projectId: params.id }, data: { status: 'ARCHIVED' as any } });
      await tx.marketLead.updateMany({ where: { userId, projectId: params.id, workstreamId }, data: { workstreamId: null } });
      await tx.task.updateMany({ where: { userId, projectId: params.id, workstreamId }, data: { workstreamId: null } });
      await tx.projectDeal.updateMany({ where: { userId, projectId: params.id, workstreamId }, data: { workstreamId: null } });
      await tx.projectNote.updateMany({ where: { userId, projectId: params.id, workstreamId }, data: { workstreamId: null } });
    });
    throw redirect(303, `/projects/${params.id}`);
  },

  deleteWorkstream: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const workstreamId = String(form.get('workstreamId') || '').trim();
    if (!workstreamId) return fail(400, { error: 'Missing workstream id.' });
    await prisma.projectWorkstream.deleteMany({ where: { id: workstreamId, userId: locals.user.id, projectId: params.id } });
    throw redirect(303, `/projects/${params.id}`);
  },

  archiveProject: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await prisma.project.updateMany({
      where: { id: params.id, userId: locals.user.id },
      data: { status: 'ARCHIVED' as any }
    });
    throw redirect(303, '/projects');
  },

  deleteProject: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const project = await prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!project) return fail(404, { error: 'Project not found.' });
    await prisma.$transaction(async (tx: any) => {
      await tx.task.updateMany({ where: { userId, projectId: params.id }, data: { projectId: null, workstreamId: null } });
      await tx.marketLead.updateMany({ where: { userId, projectId: params.id }, data: { projectId: null, workstreamId: null } });
      await tx.exchangeItem.updateMany({ where: { userId, projectId: params.id }, data: { projectId: null } });
      await tx.project.deleteMany({ where: { id: params.id, userId } });
    });
    throw redirect(303, '/projects');
  },

  createProjectLead: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const project = await prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!project) return fail(404, { error: 'Project not found.' });
    const values = leadFormValues(await request.formData(), { projectId: params.id });
    values.projectId = params.id;
    if (values.workstreamId && !(await workstreamOk(userId, params.id, values.workstreamId))) return fail(404, { error: 'Selected workstream was not found.' });
    values.leadSourceId = (await resolveLeadSourceId(userId, values.leadSourceId, values.newLeadSource)) || '';
    if (!values.title && !values.name && !values.companyName) return fail(400, { error: 'Add at least a lead title, person name, or company name.' });
    const created = await prisma.marketLead.create({ data: marketLeadCreateData(userId, values) as any, select: { id: true } });
    throw redirect(303, `/leads/${created.id}`);
  },

  linkDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const dealId = String(form.get('dealId') || '').trim();
    const label = String(form.get('label') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    const workstreamId = String(form.get('workstreamId') || '').trim() || null;
    if (workstreamId && !(await workstreamOk(userId, params.id, workstreamId))) return fail(404, { error: 'Selected workstream was not found.' });
    if (!dealId) return fail(400, { error: 'Choose a deal to link.' });

    const [project, deal] = await Promise.all([
      prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } }),
      prisma.deal.findFirst({ where: { id: dealId, userId }, select: { id: true } })
    ]);
    if (!project || !deal) return fail(404, { error: 'Project or deal not found.' });

    await prisma.projectDeal.upsert({
      where: { projectId_dealId: { projectId: params.id, dealId } },
      update: {
        labelEnc: label ? encrypt(label, 'project_deal.label') : undefined,
        notesEnc: notes ? encrypt(notes, 'project_deal.notes') : undefined,
        workstreamId
      },
      create: {
        userId,
        projectId: params.id,
        dealId,
        labelEnc: label ? encrypt(label, 'project_deal.label') : null,
        notesEnc: notes ? encrypt(notes, 'project_deal.notes') : null,
        workstreamId
      }
    });
    throw redirect(303, `/projects/${params.id}`);
  },

  removeProjectDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing project-deal link id.' });
    await prisma.projectDeal.deleteMany({ where: { id: linkId, userId: locals.user.id, projectId: params.id } });
    throw redirect(303, `/projects/${params.id}`);
  },

  createProjectNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const project = await prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!project) return fail(404, { error: 'Project not found.' });
    const form = await request.formData();
    const body = String(form.get('body') || form.get('note') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const channel = String(form.get('channel') || 'note').trim().toLowerCase() || 'note';
    const workstreamId = String(form.get('workstreamId') || '').trim() || null;
    if (workstreamId && !(await workstreamOk(userId, params.id, workstreamId))) return fail(404, { error: 'Selected workstream was not found.' });
    if (!body) return fail(400, { error: 'Project note is required.' });
    await prisma.projectNote.create({ data: { userId, projectId: params.id, workstreamId, channel, bodyEnc: encrypt(body, 'project_note.body'), summaryEnc: summary ? encrypt(summary, 'project_note.summary') : null } });
    throw redirect(303, `/projects/${params.id}`);
  },

  deleteProjectNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const noteId = String(form.get('noteId') || '').trim();
    if (!noteId) return fail(400, { error: 'Missing project note id.' });
    await prisma.projectNote.deleteMany({ where: { id: noteId, userId: locals.user.id, projectId: params.id } });
    throw redirect(303, `/projects/${params.id}`);
  },

  createExchangeItem: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const exists = await prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!exists) return fail(404, { error: 'Project not found.' });
    try {
      await createExchangeItemFromForm({ userId, form: await request.formData(), links: { projectId: params.id } });
    } catch (err: any) {
      console.error('[projects:createExchangeItem] failed', err);
      return fail(400, { error: err?.message || 'Failed to save want/offer.' });
    }
    throw redirect(303, `/projects/${params.id}`);
  },

  deleteExchangeItem: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const exchangeItemId = String(form.get('exchangeItemId') || '').trim();
    if (!exchangeItemId) return fail(400, { error: 'Missing want/offer id.' });
    await deleteExchangeItem({ userId: locals.user.id, id: exchangeItemId, links: { projectId: params.id } });
    throw redirect(303, `/projects/${params.id}`);
  },

  updateProject: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Project title is required.' });
    const description = String(form.get('description') || '').trim();
    const duplicate = await prisma.project.findFirst({ where: { userId: locals.user.id, titleIdx: buildIndexToken(title), id: { not: params.id } }, select: { id: true } });
    if (duplicate) return fail(409, { error: 'Another project already uses this title.' });
    await prisma.project.updateMany({ where: { id: params.id, userId: locals.user.id }, data: { titleEnc: encrypt(title, 'project.title'), titleIdx: buildIndexToken(title), descriptionEnc: description ? encrypt(description, 'project.description') : null, status: normaliseProjectStatus(form.get('status')) as any } });
    throw redirect(303, `/projects/${params.id}`);
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;

    const projectOk = await prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!projectOk) return fail(404, { error: 'Project not found.' });

    const form = await request.formData();
    const result = await createTaskFromForm(userId, form, { projectId: params.id, linkProjectDeal: true });
    if (!result.ok) return fail(result.status, { error: result.error });

    throw redirect(303, `/projects/${params.id}`);
  },

  updateTaskStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });
    await prisma.task.updateMany({ where: { id: taskId, userId: locals.user.id, projectId: params.id }, data: { status, completedAt: status === 'DONE' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null } });
    throw redirect(303, `/projects/${params.id}`);
  },

  deleteTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    if (!taskId) return fail(400, { error: 'Missing task id.' });
    await prisma.task.deleteMany({ where: { id: taskId, userId: locals.user.id, projectId: params.id } });
    throw redirect(303, `/projects/${params.id}`);
  }
};

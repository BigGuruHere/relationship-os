// src/routes/leads/[id]/+page.server.ts
// PURPOSE: View, edit, convert, note, and work a single Stage 6.1 market lead.
// SECURITY: All operations are scoped by userId. PII remains encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, decrypt, encrypt } from '$lib/crypto';
import { safeDecrypt } from '$lib/deals';
import { safeDecryptCompany } from '$lib/companies';
import {
  COMMUNICATION_METHODS,
  BUYER_QUALIFICATION_STATUSES,
  CONTACT_ATTEMPT_STATUSES,
  NOTE_CHANNELS,
  MARKET_LEAD_STATUSES,
  MARKET_LEAD_TYPES,
  SELLER_QUALIFICATION_STATUSES,
  dateToDatetimeLocal,
  normaliseNoteChannel,
  noteChannelLabel,
  parseDateTime as parseLeadDateTime
} from '$lib/marketLeads';
import {
  buildLeadSourceOptions,
  convertLeadToCompany,
  convertLeadToContact,
  convertLeadToDeal,
  convertLeadToExchangeItem,
  leadFormValues,
  loadLeadSources,
  mapMarketLead,
  marketLeadCreateData,
  resolveLeadSourceId
} from '$lib/server/marketLeads';
import { createTaskFromForm } from '$lib/server/tasks';
import { contactDisplayName } from '$lib/server/contactDisplay';
import {
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  normaliseTaskStatus,
  projectStatusLabel,
  safeDecryptTask,
  taskFocusLabel,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

function contactName(row: any) {
  if (!row) return '';
  try { return row.fullNameEnc ? decrypt(row.fullNameEnc, 'contact.full_name') : ''; } catch { return ''; }
}

async function loadProjectOptions(userId: string) {
  const rows = await prisma.project.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any } },
    select: { id: true, titleEnc: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });
  return rows.map((project: any) => ({
    id: project.id,
    title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'),
    status: project.status,
    statusLabel: projectStatusLabel(project.status)
  }));
}

async function loadWorkstreamOptions(userId: string) {
  const rows = await prisma.projectWorkstream.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any } },
    select: { id: true, nameEnc: true, projectId: true, status: true, project: { select: { id: true, titleEnc: true } } },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    take: 300
  });
  return rows.map((ws: any) => ({
    id: ws.id,
    name: safeDecryptTask(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'),
    projectId: ws.projectId,
    projectTitle: safeDecryptTask(ws.project?.titleEnc, 'project.title', 'Untitled project'),
    status: ws.status
  }));
}

async function loadCompanyOptions(userId: string) {
  const rows = await prisma.company.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any } },
    select: { id: true, nameEnc: true, phoneEnc: true, websiteEnc: true, kind: true },
    orderBy: { updatedAt: 'desc' },
    take: 500
  });
  return rows.map((company: any) => ({
    id: company.id,
    name: safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company'),
    phone: safeDecryptCompany(company.phoneEnc, 'company.phone', ''),
    website: safeDecryptCompany(company.websiteEnc, 'company.website', ''),
    kind: company.kind
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));
}

function mapLeadNote(note: any) {
  return {
    id: note.id,
    body: safeDecryptTask(note.bodyEnc, 'market_lead_note.body', ''),
    summary: safeDecryptTask(note.summaryEnc, 'market_lead_note.summary', ''),
    channel: note.channel || 'note',
    channelLabel: noteChannelLabel(note.channel),
    occurredAt: note.occurredAt || note.createdAt,
    occurredAtInput: dateToDatetimeLocal(note.occurredAt || note.createdAt),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

async function mapLeadTask(task: any) {
  return {
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
    assignedToText: safeDecryptTask(task.assignedToTextEnc, 'task.assigned_to_text', ''),
    assignedToContact: task.assignedToContact ? { id: task.assignedToContact.id, name: await contactDisplayName(task.assignedToContact) } : null,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
    project: task.project ? { id: task.project.id, title: safeDecryptTask(task.project.titleEnc, 'project.title', 'Untitled project') } : null,
    workstream: task.workstream ? { id: task.workstream.id, name: safeDecryptTask(task.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream') } : null,
    contact: task.contact ? { id: task.contact.id, name: contactName(task.contact) } : null,
    company: task.company ? { id: task.company.id, name: safeDecryptCompany(task.company.nameEnc, 'company.name', 'Untitled company') } : null,
    deal: task.deal ? { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal') } : null,
    dealContact: task.dealContact ? {
      id: task.dealContact.id,
      dealId: task.dealContact.deal.id,
      contactId: task.dealContact.contact.id,
      dealTitle: safeDecrypt(task.dealContact.deal.titleEnc, 'deal.title', 'Untitled deal'),
      contactName: await contactDisplayName(task.dealContact.contact)
    } : null,
    dealCompany: task.dealCompany ? {
      id: task.dealCompany.id,
      dealId: task.dealCompany.deal.id,
      companyId: task.dealCompany.company.id,
      dealTitle: safeDecrypt(task.dealCompany.deal.titleEnc, 'deal.title', 'Untitled deal'),
      companyName: safeDecryptCompany(task.dealCompany.company.nameEnc, 'company.name', 'Untitled company')
    } : null
  };
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const row = await prisma.marketLead.findFirst({
    where: { id: params.id, userId },
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
      updatedAt: true,
      contact: { select: { id: true, fullNameEnc: true } },
      company: { select: { id: true, nameEnc: true } },
      deal: { select: { id: true, titleEnc: true } },
      project: { select: { id: true, titleEnc: true } },
      exchangeItem: { select: { id: true, titleEnc: true, type: true } }
    }
  });

  if (!row) throw redirect(303, '/leads');
  const lead = mapMarketLead(row);

  const [leadNotesRaw, leadTasksRaw, projects, workstreams, companies, customLeadSources] = await Promise.all([
    prisma.marketLeadNote.findMany({
      where: { userId, marketLeadId: row.id },
      select: { id: true, channel: true, occurredAt: true, bodyEnc: true, summaryEnc: true, createdAt: true, updatedAt: true },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 120
    }),
    prisma.task.findMany({
      where: { userId, marketLeadId: row.id },
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
        assignedToTextEnc: true,
        assignedToContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
        waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
        project: { select: { id: true, titleEnc: true } },
        workstream: { select: { id: true, nameEnc: true, projectId: true } },
        contact: { select: { id: true, fullNameEnc: true } },
        company: { select: { id: true, nameEnc: true } },
        deal: { select: { id: true, titleEnc: true } },
        dealContact: { select: { id: true, deal: { select: { id: true, titleEnc: true } }, contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } } } },
        dealCompany: { select: { id: true, deal: { select: { id: true, titleEnc: true } }, company: { select: { id: true, nameEnc: true } } } }
      },
      orderBy: [{ focus: 'asc' }, { status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 150
    }),
    loadProjectOptions(userId),
    loadWorkstreamOptions(userId),
    loadCompanyOptions(userId),
    loadLeadSources(userId)
  ]);

  // IT: full canonical picker option lists for TasksPanel - see src/lib/TasksPanel.svelte. Project,
  // contact, company, deal, and workstream are inherited from the lead by createTaskFromForm and are
  // not offered as separate pickers here; contactOptions is still needed for the always-visible
  // assigned-to/waiting-on pickers, and the deal-thread pickers are scoped to the lead's own deal.
  const [taskContactsRaw, taskDealContactsRaw, taskDealCompaniesRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    row.dealId
      ? prisma.dealContact.findMany({ where: { userId, dealId: row.dealId }, select: { id: true, label: true, deal: { select: { id: true, titleEnc: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 })
      : Promise.resolve([]),
    row.dealId
      ? prisma.dealCompany.findMany({ where: { userId, dealId: row.dealId }, select: { id: true, label: true, deal: { select: { id: true, titleEnc: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 })
      : Promise.resolve([])
  ]);
  const taskContactOptions = await Promise.all(taskContactsRaw.map(async (c: any) => ({ id: c.id, name: await contactDisplayName(c) })));
  const taskDealContactOptions = taskDealContactsRaw.map((link: any) => ({ id: link.id, dealId: link.deal.id, title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')}${link.label ? ` (${link.label})` : ''}` }));
  const taskDealCompanyOptions = taskDealCompaniesRaw.map((link: any) => ({ id: link.id, dealId: link.deal.id, title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')}${link.label ? ` (${link.label})` : ''}` }));

  return {
    lead: {
      ...lead,
      nextActionAtInput: dateToDatetimeLocal(lead.nextActionAt),
      lastContactedAtInput: dateToDatetimeLocal(lead.lastContactedAt),
      valueMin: typeof lead.valueMinCents === 'number' ? (lead.valueMinCents / 100).toFixed(2) : '',
      valueMax: typeof lead.valueMaxCents === 'number' ? (lead.valueMaxCents / 100).toFixed(2) : '',
      linkedContactName: contactName(row.contact),
      linkedCompanyName: row.company ? safeDecryptCompany(row.company.nameEnc, 'company.name', '') : '',
      linkedDealTitle: row.deal ? safeDecrypt(row.deal.titleEnc, 'deal.title', '') : '',
      linkedProjectTitle: row.project ? safeDecryptTask(row.project.titleEnc, 'project.title', '') : '',
      linkedWorkstreamTitle: row.workstream ? safeDecryptTask(row.workstream.nameEnc, 'project_workstream.name', '') : '',
      linkedExchangeTitle: row.exchangeItem ? safeDecrypt(row.exchangeItem.titleEnc, 'exchange.title', '') : ''
    },
    leadNotes: leadNotesRaw.map(mapLeadNote),
    leadTasks: await Promise.all(leadTasksRaw.map(mapLeadTask)),
    projects,
    workstreams,
    companies,
    leadTypes: MARKET_LEAD_TYPES,
    leadStatuses: MARKET_LEAD_STATUSES,
    leadSourceOptions: buildLeadSourceOptions(customLeadSources),
    contactAttemptStatuses: CONTACT_ATTEMPT_STATUSES,
    buyerQualificationStatuses: BUYER_QUALIFICATION_STATUSES,
    sellerQualificationStatuses: SELLER_QUALIFICATION_STATUSES,
    communicationMethods: COMMUNICATION_METHODS,
    noteChannels: NOTE_CHANNELS,
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    taskTypes: TASK_TYPES,
    taskContactOptions,
    taskDealContactOptions,
    taskDealCompanyOptions
  };
};

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const existing = await prisma.marketLead.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!existing) return fail(404, { error: 'Lead not found.' });

    const values = leadFormValues(await request.formData());
    if (!values.title && !values.name && !values.companyName) return fail(400, { error: 'Add a title, person name, or company name.' });

    if (values.projectId) {
      const projectOk = await prisma.project.findFirst({ where: { id: values.projectId, userId }, select: { id: true } });
      if (!projectOk) return fail(404, { error: 'Selected project was not found.' });
    }
    if (values.workstreamId) {
      const ws = await prisma.projectWorkstream.findFirst({ where: { id: values.workstreamId, userId }, select: { id: true, projectId: true } });
      if (!ws) return fail(404, { error: 'Selected workstream was not found.' });
      values.projectId = values.projectId || ws.projectId;
      if (values.projectId !== ws.projectId) return fail(400, { error: 'Selected workstream belongs to a different project.' });
    }

    values.leadSourceId = (await resolveLeadSourceId(userId, values.leadSourceId, values.newLeadSource)) || '';
    const data: any = marketLeadCreateData(userId, values);
    delete data.userId;
    // IT: editing text/status/project fields should not unlink already converted records.
    delete data.contactId;
    delete data.companyId;
    delete data.dealId;
    await prisma.marketLead.updateMany({ where: { id: params.id, userId }, data });
    throw redirect(303, `/leads/${params.id}`);
  },

  createLeadNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const lead = await prisma.marketLead.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!lead) return fail(404, { error: 'Lead not found.' });

    const form = await request.formData();
    const body = String(form.get('body') || form.get('note') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const channel = normaliseNoteChannel(form.get('channel'));
    const occurredAt = parseLeadDateTime(form.get('occurredAt')) || new Date();
    if (!body) return fail(400, { error: 'Lead note is required.' });

    await prisma.marketLeadNote.create({
      data: {
        userId,
        marketLeadId: params.id,
        channel,
        occurredAt,
        bodyEnc: encrypt(body, 'market_lead_note.body'),
        summaryEnc: summary ? encrypt(summary, 'market_lead_note.summary') : null
      }
    });
    throw redirect(303, `/leads/${params.id}`);
  },


  updateLeadNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const noteId = String(form.get('noteId') || '').trim();
    const body = String(form.get('body') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const channel = normaliseNoteChannel(form.get('channel'));
    const occurredAt = parseLeadDateTime(form.get('occurredAt')) || new Date();
    if (!noteId) return fail(400, { error: 'Missing lead note id.' });
    if (!body) return fail(400, { error: 'Lead note is required.' });
    await prisma.marketLeadNote.updateMany({
      where: { id: noteId, userId, marketLeadId: params.id },
      data: {
        channel,
        occurredAt,
        bodyEnc: encrypt(body, 'market_lead_note.body'),
        summaryEnc: summary ? encrypt(summary, 'market_lead_note.summary') : null
      }
    });
    throw redirect(303, `/leads/${params.id}`);
  },

  deleteLeadNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const noteId = String((await request.formData()).get('noteId') || '').trim();
    if (!noteId) return fail(400, { error: 'Missing lead note id.' });
    await prisma.marketLeadNote.deleteMany({ where: { id: noteId, userId: locals.user.id, marketLeadId: params.id } });
    throw redirect(303, `/leads/${params.id}`);
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const lead = await prisma.marketLead.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!lead) return fail(404, { error: 'Lead not found.' });

    const form = await request.formData();
    const result = await createTaskFromForm(userId, form, { marketLeadId: params.id });
    if (!result.ok) return fail(result.status, { error: result.error });
    throw redirect(303, `/leads/${params.id}`);
  },

  updateTaskStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });
    await prisma.task.updateMany({
      where: { id: taskId, userId: locals.user.id, marketLeadId: params.id },
      data: { status, completedAt: status === 'DONE' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null }
    });
    throw redirect(303, `/leads/${params.id}`);
  },

  deleteTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const taskId = String((await request.formData()).get('taskId') || '').trim();
    if (!taskId) return fail(400, { error: 'Missing task id.' });
    await prisma.task.deleteMany({ where: { id: taskId, userId: locals.user.id, marketLeadId: params.id } });
    throw redirect(303, `/leads/${params.id}`);
  },

  linkCompany: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const companyId = String(form.get('companyId') || '').trim();
    if (!companyId) return fail(400, { error: 'Please select a company.' });
    const [lead, company] = await Promise.all([
      prisma.marketLead.findFirst({ where: { id: params.id, userId }, select: { id: true, companyNameEnc: true } }),
      prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true, nameEnc: true } })
    ]);
    if (!lead || !company) return fail(404, { error: 'Lead or company not found.' });
    const companyName = safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company');
    const data: any = { companyId };
    if (!lead.companyNameEnc) {
      data.companyNameEnc = encrypt(companyName, 'market_lead.company_name');
      data.companyNameIdx = buildIndexToken(companyName);
    }
    await prisma.marketLead.updateMany({ where: { id: params.id, userId }, data });
    await prisma.task.updateMany({ where: { userId, marketLeadId: params.id, companyId: null }, data: { companyId } }).catch(() => null);
    throw redirect(303, `/leads/${params.id}`);
  },

  unlinkCompany: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await prisma.marketLead.updateMany({ where: { id: params.id, userId: locals.user.id }, data: { companyId: null } });
    throw redirect(303, `/leads/${params.id}`);
  },

  convertToContact: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const contactId = await convertLeadToContact(locals.user.id, params.id);
      throw redirect(303, `/contacts/${contactId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to contact.' });
    }
  },

  convertToCompany: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const companyId = await convertLeadToCompany(locals.user.id, params.id);
      throw redirect(303, `/companies/${companyId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to company.' });
    }
  },

  convertToDeal: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const dealId = await convertLeadToDeal(locals.user.id, params.id);
      throw redirect(303, `/deals/${dealId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to deal.' });
    }
  },

  convertToWant: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const exchangeId = await convertLeadToExchangeItem(locals.user.id, params.id, 'WANT');
      throw redirect(303, `/leads/${params.id}?converted=want&exchangeItemId=${exchangeId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to want.' });
    }
  },

  convertToOffer: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const exchangeId = await convertLeadToExchangeItem(locals.user.id, params.id, 'OFFER');
      throw redirect(303, `/leads/${params.id}?converted=offer&exchangeItemId=${exchangeId}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not convert lead to offer.' });
    }
  },

  archive: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await prisma.marketLead.updateMany({ where: { id: params.id, userId: locals.user.id }, data: { status: 'ARCHIVED' as any } });
    throw redirect(303, '/leads');
  }
};

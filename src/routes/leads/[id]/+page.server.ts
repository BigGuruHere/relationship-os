// src/routes/leads/[id]/+page.server.ts
// PURPOSE: View, edit, convert, note, and work a single Stage 6.1 market lead.
// SECURITY: All operations are scoped by userId. PII remains encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
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
import {
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  normaliseTaskFocus,
  normaliseTaskImportance,
  normaliseTaskStatus,
  normaliseTaskType,
  normaliseTaskUrgency,
  parseDateTime,
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

function mapLeadTask(task: any) {
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
    project: task.project ? { id: task.project.id, title: safeDecryptTask(task.project.titleEnc, 'project.title', 'Untitled project') } : null,
    workstream: task.workstream ? { id: task.workstream.id, name: safeDecryptTask(task.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream') } : null,
    contact: task.contact ? { id: task.contact.id, name: contactName(task.contact) } : null,
    company: task.company ? { id: task.company.id, name: safeDecryptCompany(task.company.nameEnc, 'company.name', 'Untitled company') } : null,
    deal: task.deal ? { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal') } : null
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

  const [leadNotesRaw, leadTasksRaw, projects, workstreams, customLeadSources] = await Promise.all([
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
        project: { select: { id: true, titleEnc: true } },
        workstream: { select: { id: true, nameEnc: true, projectId: true } },
        contact: { select: { id: true, fullNameEnc: true } },
        company: { select: { id: true, nameEnc: true } },
        deal: { select: { id: true, titleEnc: true } }
      },
      orderBy: [{ focus: 'asc' }, { status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 150
    }),
    loadProjectOptions(userId),
    loadWorkstreamOptions(userId),
    loadLeadSources(userId)
  ]);

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
    leadTasks: leadTasksRaw.map(mapLeadTask),
    projects,
    workstreams,
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
    taskTypes: TASK_TYPES
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
    const lead = await prisma.marketLead.findFirst({ where: { id: params.id, userId }, select: { id: true, projectId: true, workstreamId: true, contactId: true, companyId: true, dealId: true } });
    if (!lead) return fail(404, { error: 'Lead not found.' });

    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Task title is required.' });
    const notes = String(form.get('notes') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const assignedToText = String(form.get('assignedToText') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));

    await prisma.task.create({
      data: {
        userId,
        marketLeadId: params.id,
        projectId: lead.projectId || null,
        workstreamId: lead.workstreamId || null,
        contactId: lead.contactId || null,
        companyId: lead.companyId || null,
        dealId: lead.dealId || null,
        titleEnc: encrypt(title, 'task.title'),
        notesEnc: notes ? encrypt(notes, 'task.notes') : null,
        summaryEnc: summary ? encrypt(summary, 'task.summary') : null,
        status: status as any,
        urgency: normaliseTaskUrgency(form.get('urgency')) as any,
        importance: normaliseTaskImportance(form.get('importance')) as any,
        focus: normaliseTaskFocus(form.get('focus')) as any,
        taskType: normaliseTaskType(form.get('taskType')) as any,
        dueAt: parseDateTime(form.get('dueAt')),
        snoozedUntil: parseDateTime(form.get('snoozedUntil')),
        completedAt: status === 'DONE' ? new Date() : null,
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
        assignedToTextEnc: assignedToText ? encrypt(assignedToText, 'task.assigned_to_text') : null
      }
    });
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

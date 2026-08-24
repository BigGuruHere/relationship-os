// src/routes/companies/[id]/contacts/[linkId]/+page.server.ts
// PURPOSE: First-class workspace for one contact-company relationship.
// SECURITY: Every read/write is tenant-scoped and encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { createExchangeItemFromForm, deleteExchangeItem, loadExchangeItems } from '$lib/server/exchange';
import { createWantFromForm, deleteWant, loadWants } from '$lib/server/wants';
import { companyContactStatusLabel, companyDisplay, COMPANY_CONTACT_STATUSES, normaliseCompanyContactStatus, safeDecryptCompany } from '$lib/companies';
import { safeDecrypt, dealRelationshipLabel, normaliseDealRelationshipType, DEAL_RELATIONSHIP_TYPES, dealStatusLabel } from '$lib/deals';
import {
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  dateTimeToInputValue,
  normaliseTaskStatus,
  safeDecryptTask,
  taskFocusLabel,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';
import { NOTE_CHANNELS, dateToDatetimeLocal, marketLeadStatusLabel, normaliseNoteChannel, noteChannelLabel, parseDateTime as parseLeadDateTime } from '$lib/marketLeads';
import { createTaskFromForm } from '$lib/server/tasks';

async function loadRelationship(userId: string, companyId: string, linkId: string) {
  const row = await prisma.companyContact.findFirst({
    where: { id: linkId, userId, companyId },
    select: {
      id: true,
      titleEnc: true,
      departmentEnc: true,
      notesEnc: true,
      status: true,
      isPrimary: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, nameEnc: true, websiteEnc: true, phoneEnc: true, status: true, kind: true } },
      contact: {
        select: {
          id: true,
          fullNameEnc: true,
          emailEnc: true,
          phoneEnc: true,
          positionEnc: true,
          linkedinEnc: true,
          buyerStatus: true,
          sellerStatus: true,
          contactAttemptStatus: true,
          lastContactedAt: true
        }
      }
    }
  });
  return row;
}

function mapCompanyContactNote(note: any) {
  return {
    id: note.id,
    body: safeDecryptTask(note.bodyEnc, 'company_contact_note.body', ''),
    summary: safeDecryptTask(note.summaryEnc, 'company_contact_note.summary', ''),
    channel: note.channel || 'note',
    channelLabel: noteChannelLabel(note.channel),
    occurredAt: note.occurredAt || note.createdAt,
    occurredAtInput: dateToDatetimeLocal(note.occurredAt || note.createdAt),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

function mapTask(task: any) {
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
    dealId: task.dealId,
    dealTitle: task.deal ? safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal') : '',
    projectId: task.projectId,
    projectTitle: task.project ? safeDecryptTask(task.project.titleEnc, 'project.title', 'Untitled project') : '',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function mapDealContact(row: any) {
  return {
    id: row.id,
    dealId: row.deal.id,
    dealTitle: safeDecrypt(row.deal.titleEnc, 'deal.title', 'Untitled deal'),
    dealStatus: row.deal.status,
    dealStatusLabel: dealStatusLabel(row.deal.status),
    relationshipType: row.relationshipType,
    relationshipLabel: dealRelationshipLabel(row.relationshipType, row.label),
    label: row.label || '',
    notes: safeDecrypt(row.notesEnc, 'deal_contact.notes', ''),
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const companyId = params.id;
  const linkId = params.linkId;

  const relationship = await loadRelationship(userId, companyId, linkId);
  if (!relationship) throw redirect(303, `/companies/${companyId}`);

  const contactName = await contactDisplayName(relationship.contact);
  const companyName = safeDecryptCompany(relationship.company.nameEnc, 'company.name', 'Untitled company');

  const [notes, tasks, dealContacts, wants, exchangeItems, dealOptions, projectOptions] = await Promise.all([
    prisma.companyContactNote.findMany({
      where: { userId, companyContactId: linkId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 100
    }),
    prisma.task.findMany({
      where: { userId, companyContactId: linkId },
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
        dealId: true,
        deal: { select: { id: true, titleEnc: true } },
        projectId: true,
        project: { select: { id: true, titleEnc: true } },
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ status: 'asc' }, { focus: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 100
    }),
    prisma.dealContact.findMany({
      where: { userId, companyContactId: linkId },
      select: {
        id: true,
        relationshipType: true,
        label: true,
        notesEnc: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
        deal: { select: { id: true, titleEnc: true, status: true } }
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100
    }),
    loadWants({ userId, links: { companyContactId: linkId }, take: 50 }),
    loadExchangeItems({ userId, links: { companyContactId: linkId }, take: 50 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' } }, select: { id: true, titleEnc: true }, orderBy: { updatedAt: 'desc' }, take: 200 })
  ]);

  const relationshipContactId = relationship.contact.id;
  const relationshipCompanyId = relationship.company.id;

  // IT: full canonical picker option lists for TasksPanel - see src/lib/TasksPanel.svelte. Must
  // include the relationship's own contact/company so the locked waiting-on preselect can find it.
  const [taskContactsRaw, taskCompaniesRaw, taskWorkstreamsRaw, taskMarketLeadsRaw, taskDealContactsRaw, taskDealCompaniesRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, kind: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.projectWorkstream.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, nameEnc: true, projectId: true, status: true, sortOrder: true, project: { select: { id: true, titleEnc: true } } },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 300
    }),
    prisma.marketLead.findMany({
      where: { userId, OR: [{ contactId: relationshipContactId }, { companyId: relationshipCompanyId }], status: { not: 'ARCHIVED' as any } },
      select: { id: true, titleEnc: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 100
    }),
    prisma.dealContact.findMany({
      where: { userId, contactId: relationshipContactId },
      select: { id: true, label: true, deal: { select: { id: true, titleEnc: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100
    }),
    prisma.dealCompany.findMany({
      where: { userId, companyId: relationshipCompanyId },
      select: { id: true, label: true, deal: { select: { id: true, titleEnc: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100
    })
  ]);

  const taskContactOptions = await Promise.all(taskContactsRaw.map(async (c: any) => ({ id: c.id, name: await contactDisplayName(c) })));
  const taskCompanyOptions = taskCompaniesRaw.map((c: any) => ({ id: c.id, name: companyDisplay(c) }));
  const taskWorkstreamOptions = taskWorkstreamsRaw.map((ws: any) => ({
    id: ws.id,
    name: safeDecryptTask(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'),
    projectId: ws.projectId,
    projectTitle: safeDecryptTask(ws.project?.titleEnc, 'project.title', 'Untitled project')
  }));
  const taskMarketLeadOptions = taskMarketLeadsRaw.map((lead: any) => ({ id: lead.id, title: safeDecryptTask(lead.titleEnc, 'market_lead.title', 'Untitled lead'), statusLabel: marketLeadStatusLabel(lead.status) }));
  const taskDealContactOptions = taskDealContactsRaw.map((link: any) => ({ id: link.id, dealId: link.deal.id, title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')}${link.label ? ` (${link.label})` : ''}` }));
  const taskDealCompanyOptions = taskDealCompaniesRaw.map((link: any) => ({ id: link.id, dealId: link.deal.id, title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')}${link.label ? ` (${link.label})` : ''}` }));

  return {
    relationship: {
      id: relationship.id,
      companyId: relationship.company.id,
      contactId: relationship.contact.id,
      companyName,
      companyWebsite: safeDecryptCompany(relationship.company.websiteEnc, 'company.website', ''),
      companyPhone: safeDecryptCompany(relationship.company.phoneEnc, 'company.phone', ''),
      contactName,
      contactEmail: safeDecrypt(relationship.contact.emailEnc, 'contact.email', ''),
      contactPhone: safeDecrypt(relationship.contact.phoneEnc, 'contact.phone', ''),
      contactPosition: safeDecrypt(relationship.contact.positionEnc, 'contact.position', ''),
      contactLinkedin: safeDecrypt(relationship.contact.linkedinEnc, 'contact.linkedin', ''),
      title: safeDecryptCompany(relationship.titleEnc, 'company_contact.title', ''),
      department: safeDecryptCompany(relationship.departmentEnc, 'company_contact.department', ''),
      notes: safeDecryptCompany(relationship.notesEnc, 'company_contact.notes', ''),
      status: relationship.status,
      statusLabel: companyContactStatusLabel(relationship.status),
      isPrimary: relationship.isPrimary,
      startDate: relationship.startDate,
      endDate: relationship.endDate,
      createdAt: relationship.createdAt,
      updatedAt: relationship.updatedAt
    },
    notes: notes.map(mapCompanyContactNote),
    tasks: tasks.map(mapTask),
    dealContacts: dealContacts.map(mapDealContact),
    wants,
    exchangeItems,
    dealOptions: dealOptions.map((d: any) => ({ id: d.id, title: safeDecrypt(d.titleEnc, 'deal.title', 'Untitled deal'), status: d.status, statusLabel: dealStatusLabel(d.status) })),
    projectOptions: projectOptions.map((p: any) => ({ id: p.id, title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project') })),
    taskContactOptions,
    taskCompanyOptions,
    taskWorkstreamOptions,
    taskMarketLeadOptions,
    taskDealContactOptions,
    taskDealCompanyOptions,
    companyContactStatuses: COMPANY_CONTACT_STATUSES,
    noteChannels: NOTE_CHANNELS,
    taskTypes: TASK_TYPES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskStatuses: TASK_STATUSES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    dealRelationshipTypes: DEAL_RELATIONSHIP_TYPES
  };
};

export const actions: Actions = {
  updateRelationship: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const relationship = await loadRelationship(userId, params.id, params.linkId);
    if (!relationship) return fail(404, { error: 'Relationship not found.' });

    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    const department = String(form.get('department') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    const status = normaliseCompanyContactStatus(form.get('status'));
    const isPrimary = form.get('isPrimary') === 'on';

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.companyContact.updateMany({ where: { userId, companyId: params.id, isPrimary: true }, data: { isPrimary: false } });
      }
      await tx.companyContact.update({
        where: { id: relationship.id },
        data: {
          titleEnc: title ? encrypt(title, 'company_contact.title') : null,
          departmentEnc: department ? encrypt(department, 'company_contact.department') : null,
          notesEnc: notes ? encrypt(notes, 'company_contact.notes') : null,
          status: status as any,
          isPrimary
        }
      });
    });

    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  createNote: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const relationship = await loadRelationship(userId, params.id, params.linkId);
    if (!relationship) return fail(404, { error: 'Relationship not found.' });

    const form = await request.formData();
    const body = String(form.get('body') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    if (!body) return fail(400, { error: 'Note text is required.' });

    await prisma.companyContactNote.create({
      data: {
        userId,
        companyContactId: relationship.id,
        companyId: relationship.company.id,
        contactId: relationship.contact.id,
        occurredAt: parseLeadDateTime(form.get('occurredAt')) || new Date(),
        channel: normaliseNoteChannel(form.get('channel')),
        bodyEnc: encrypt(body, 'company_contact_note.body'),
        summaryEnc: summary ? encrypt(summary, 'company_contact_note.summary') : null
      }
    });

    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  updateNote: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const relationship = await loadRelationship(userId, params.id, params.linkId);
    if (!relationship) return fail(404, { error: 'Relationship not found.' });

    const form = await request.formData();
    const noteId = String(form.get('noteId') || '');
    const body = String(form.get('body') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    if (!noteId || !body) return fail(400, { error: 'Note text is required.' });

    await prisma.companyContactNote.updateMany({
      where: { id: noteId, userId, companyContactId: relationship.id },
      data: {
        occurredAt: parseLeadDateTime(form.get('occurredAt')) || new Date(),
        channel: normaliseNoteChannel(form.get('channel')),
        bodyEnc: encrypt(body, 'company_contact_note.body'),
        summaryEnc: summary ? encrypt(summary, 'company_contact_note.summary') : null
      }
    });

    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  deleteNote: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    await prisma.companyContactNote.deleteMany({
      where: { id: String(form.get('noteId') || ''), userId: locals.user.id, companyContactId: params.linkId }
    });
    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  createTask: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const relationship = await loadRelationship(userId, params.id, params.linkId);
    if (!relationship) return fail(404, { error: 'Relationship not found.' });

    const form = await request.formData();
    const result = await createTaskFromForm(userId, form, {
      contactId: relationship.contact.id,
      companyId: relationship.company.id,
      companyContactId: relationship.id
    });
    if (!result.ok) return fail(result.status, { error: result.error });

    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  updateTaskStatus: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    await prisma.task.updateMany({
      where: { id: String(form.get('taskId') || ''), userId: locals.user.id, companyContactId: params.linkId },
      data: { status: normaliseTaskStatus(form.get('status')) as any }
    });
    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  linkDeal: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const relationship = await loadRelationship(userId, params.id, params.linkId);
    if (!relationship) return fail(404, { error: 'Relationship not found.' });

    const form = await request.formData();
    const dealId = String(form.get('dealId') || '').trim();
    if (!dealId) return fail(400, { error: 'Choose a deal to link.' });
    const deal = await prisma.deal.findFirst({ where: { id: dealId, userId }, select: { id: true } });
    if (!deal) return fail(404, { error: 'Deal not found.' });

    const notes = String(form.get('notes') || '').trim();
    const label = String(form.get('label') || '').trim() || 'company relationship';
    const relationshipType = normaliseDealRelationshipType(form.get('relationshipType'));
    const existing = await prisma.dealContact.findFirst({ where: { userId, dealId, contactId: relationship.contact.id }, select: { id: true } });
    if (existing) {
      await prisma.dealContact.update({
        where: { id: existing.id },
        data: {
          companyContactId: relationship.id,
          relationshipType: relationshipType as any,
          label,
          notesEnc: notes ? encrypt(notes, 'deal_contact.notes') : undefined
        }
      });
    } else {
      await prisma.dealContact.create({
        data: {
          userId,
          dealId,
          contactId: relationship.contact.id,
          companyContactId: relationship.id,
          relationshipType: relationshipType as any,
          label,
          notesEnc: notes ? encrypt(notes, 'deal_contact.notes') : null
        }
      });
    }

    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  unlinkDeal: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const dealContactId = String(form.get('dealContactId') || '');
    await prisma.dealContact.updateMany({
      where: { id: dealContactId, userId: locals.user.id, companyContactId: params.linkId },
      data: { companyContactId: null }
    });
    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  createWant: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    try {
      await createWantFromForm({ userId, form: await request.formData(), links: { companyContactId: params.linkId } });
    } catch (err: any) {
      console.error('[wants:createWant] failed', err);
      return fail(400, { error: err?.message || 'Failed to save want.' });
    }
    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  deleteWant: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const wantId = String(form.get('wantId') || '').trim();
    if (!wantId) return fail(400, { error: 'Missing want id.' });
    await deleteWant({ userId: locals.user.id, id: wantId, links: { companyContactId: params.linkId } });
    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  createExchangeItem: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const relationship = await loadRelationship(userId, params.id, params.linkId);
    if (!relationship) return fail(404, { error: 'Relationship not found.' });
    const form = await request.formData();
    await createExchangeItemFromForm({
      userId,
      form,
      links: { companyContactId: relationship.id, companyId: relationship.company.id, contactId: relationship.contact.id }
    });
    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  },

  deleteExchangeItem: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    await deleteExchangeItem({
      userId: locals.user.id,
      id: String(form.get('exchangeItemId') || ''),
      links: { companyContactId: params.linkId }
    });
    throw redirect(303, `/companies/${params.id}/contacts/${params.linkId}`);
  }
};

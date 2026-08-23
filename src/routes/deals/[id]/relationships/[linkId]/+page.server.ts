// src/routes/deals/[id]/relationships/[linkId]/+page.server.ts
// PURPOSE: Manage one commercial conversation thread between one person and one deal.
// SECURITY: All reads and writes are scoped by userId and dealId/linkId.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { createTaskFromForm } from '$lib/server/tasks';
import { companyDisplay } from '$lib/companies';
import { NOTE_CHANNELS, marketLeadStatusLabel, normaliseNoteChannel, noteChannelLabel } from '$lib/marketLeads';
import { DEAL_RELATIONSHIP_TYPES, dealRelationshipLabel, normaliseDealRelationshipType, safeDecrypt } from '$lib/deals';
import {
  DEAL_CONFIDENTIALITY_STAGES,
  DEAL_CONTACT_INTERESTS,
  DEAL_CONTACT_STAGES,
  PROJECT_STATUSES,
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  dateTimeToInputValue,
  dealConfidentialityLabel,
  dealContactInterestLabel,
  dealContactStageLabel,
  normaliseDealConfidentiality,
  normaliseDealContactInterest,
  normaliseDealContactStage,
  normaliseTaskStatus,
  parseDateTime,
  projectStatusLabel,
  safeDecryptTask,
  taskFocusLabel,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

async function loadOwnedLink(userId: string, dealId: string, linkId: string) {
  return prisma.dealContact.findFirst({
    where: { id: linkId, dealId, userId },
    select: {
      id: true,
      dealId: true,
      contactId: true,
      relationshipType: true,
      label: true,
      notesEnc: true,
      isPrimary: true,
      stage: true,
      interestLevel: true,
      confidentialityStage: true,
      nextActionEnc: true,
      nextFollowUpAt: true,
      lastContactedAt: true,
      buyingCriteriaEnc: true,
      objectionsEnc: true,
      fundingCapacityEnc: true,
      referralPathEnc: true,
      createdAt: true,
      updatedAt: true,
      deal: { select: { id: true, titleEnc: true, status: true } },
      contact: { select: { id: true, fullNameEnc: true, companyEnc: true, emailEnc: true, phoneEnc: true, linkedUserId: true } }
    }
  });
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const link = await loadOwnedLink(userId, params.id, params.linkId);
  if (!link) throw redirect(303, `/deals/${params.id}`);

  const notesRaw = await prisma.dealContactNote.findMany({
    where: { userId, dealContactId: link.id },
    select: { id: true, channel: true, occurredAt: true, rawTextEnc: true, summaryEnc: true },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 40
  });

  const notes = notesRaw.map((note: any) => {
    const rawText = safeDecryptTask(note.rawTextEnc, 'deal_contact_note.raw_text', '');
    const summary = safeDecryptTask(note.summaryEnc, 'deal_contact_note.summary', '');
    const previewSource = summary || rawText;
    return {
      id: note.id,
      channel: note.channel,
      channelLabel: noteChannelLabel(note.channel),
      occurredAt: note.occurredAt,
      occurredAtInput: dateTimeToInputValue(note.occurredAt),
      rawText,
      preview: previewSource.length > 320 ? `${previewSource.slice(0, 317)}...` : previewSource,
      summary
    };
  });

  const tasksRaw = await prisma.task.findMany({
    where: { userId, dealContactId: link.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
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
      assignedToTextEnc: true,
      assignedToContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      project: { select: { id: true, titleEnc: true, status: true } },
      workstream: { select: { id: true, nameEnc: true, projectId: true } },
      marketLead: { select: { id: true, titleEnc: true, status: true } },
      company: { select: { id: true, nameEnc: true, kind: true } },
      dealCompany: {
        select: {
          id: true,
          deal: { select: { id: true, titleEnc: true } },
          company: { select: { id: true, nameEnc: true, kind: true } }
        }
      }
    },
    orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }]
  });

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
    assignedToText: safeDecryptTask(task.assignedToTextEnc, 'task.assigned_to_text', ''),
    assignedToContact: task.assignedToContact ? { id: task.assignedToContact.id, name: await contactDisplayName(task.assignedToContact) } : null,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
    project: task.project ? { id: task.project.id, title: safeDecryptTask(task.project.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(task.project.status) } : null,
    workstream: task.workstream ? { id: task.workstream.id, name: safeDecryptTask(task.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectId: task.workstream.projectId } : null,
    marketLead: task.marketLead ? { id: task.marketLead.id, title: safeDecryptTask(task.marketLead.titleEnc, 'market_lead.title', 'Untitled lead'), statusLabel: marketLeadStatusLabel(task.marketLead.status) } : null,
    company: task.company ? { id: task.company.id, name: companyDisplay(task.company) } : null,
    dealCompany: task.dealCompany ? {
      id: task.dealCompany.id,
      dealId: task.dealCompany.deal.id,
      companyId: task.dealCompany.company.id,
      dealTitle: safeDecrypt(task.dealCompany.deal.titleEnc, 'deal.title', 'Untitled deal'),
      companyName: companyDisplay(task.dealCompany.company)
    } : null
  })));

  // IT: full canonical picker option lists for TasksPanel - see src/lib/TasksPanel.svelte. Person
  // and deal are locked to this thread, so only contact/company/project/workstream/lead/deal-company
  // pickers are needed - contactOptions must include this thread's own contact for the locked
  // waiting-on preselect to find it.
  const [projectsRaw, taskContactsRaw, taskCompaniesRaw, taskWorkstreamsRaw, taskMarketLeadsRaw, taskDealCompaniesRaw] = await Promise.all([
    prisma.project.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, titleEnc: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 200
    }),
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, kind: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.projectWorkstream.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, nameEnc: true, projectId: true, status: true, sortOrder: true, project: { select: { id: true, titleEnc: true } } },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 300
    }),
    prisma.marketLead.findMany({
      where: { userId, OR: [{ contactId: link.contactId }, { dealId: link.dealId }], status: { not: 'ARCHIVED' as any } },
      select: { id: true, titleEnc: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 100
    }),
    prisma.dealCompany.findMany({
      where: { userId, dealId: link.dealId },
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
  const taskDealCompanyOptions = taskDealCompaniesRaw.map((dc: any) => ({ id: dc.id, dealId: dc.deal.id, title: `${safeDecrypt(dc.deal.titleEnc, 'deal.title', 'Untitled deal')}${dc.label ? ` (${dc.label})` : ''}` }));

  return {
    thread: {
      id: link.id,
      dealId: link.dealId,
      dealTitle: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
      contactId: link.contactId,
      contactName: await contactDisplayName(link.contact),
      company: safeDecrypt(link.contact.companyEnc, 'contact.company', ''),
      email: safeDecrypt(link.contact.emailEnc, 'contact.email', ''),
      phone: safeDecrypt(link.contact.phoneEnc, 'contact.phone', ''),
      relationshipType: link.relationshipType,
      relationshipLabel: dealRelationshipLabel(link.relationshipType, link.label),
      label: link.label || '',
      notes: safeDecrypt(link.notesEnc, 'deal_contact.notes', ''),
      isPrimary: link.isPrimary,
      stage: link.stage,
      stageLabel: dealContactStageLabel(link.stage),
      interestLevel: link.interestLevel,
      interestLabel: dealContactInterestLabel(link.interestLevel),
      confidentialityStage: link.confidentialityStage,
      confidentialityLabel: dealConfidentialityLabel(link.confidentialityStage),
      nextAction: safeDecryptTask(link.nextActionEnc, 'deal_contact.next_action', ''),
      nextFollowUpAt: link.nextFollowUpAt,
      nextFollowUpAtInput: dateTimeToInputValue(link.nextFollowUpAt),
      lastContactedAt: link.lastContactedAt,
      lastContactedAtInput: dateTimeToInputValue(link.lastContactedAt),
      buyingCriteria: safeDecryptTask(link.buyingCriteriaEnc, 'deal_contact.buying_criteria', ''),
      objections: safeDecryptTask(link.objectionsEnc, 'deal_contact.objections', ''),
      fundingCapacity: safeDecryptTask(link.fundingCapacityEnc, 'deal_contact.funding_capacity', ''),
      referralPath: safeDecryptTask(link.referralPathEnc, 'deal_contact.referral_path', ''),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt
    },
    notes,
    tasks,
    noteChannels: NOTE_CHANNELS,
    relationshipOptions: DEAL_RELATIONSHIP_TYPES,
    dealContactStageOptions: DEAL_CONTACT_STAGES,
    dealContactInterestOptions: DEAL_CONTACT_INTERESTS,
    dealConfidentialityOptions: DEAL_CONFIDENTIALITY_STAGES,
    taskStatusOptions: TASK_STATUSES,
    taskUrgencyOptions: TASK_URGENCIES,
    taskImportanceOptions: TASK_IMPORTANCES,
    taskTypeOptions: TASK_TYPES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    projectStatusOptions: PROJECT_STATUSES,
    projectOptions: projectsRaw.map((p: any) => ({ id: p.id, title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(p.status) })),
    taskContactOptions,
    taskCompanyOptions,
    taskWorkstreamOptions,
    taskMarketLeadOptions,
    taskDealCompanyOptions
  };
};

export const actions: Actions = {
  save: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();

    const link = await loadOwnedLink(userId, params.id, params.linkId);
    if (!link) return fail(404, { error: 'Deal relationship not found.' });

    const label = String(form.get('label') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    const nextAction = String(form.get('nextAction') || '').trim();
    const buyingCriteria = String(form.get('buyingCriteria') || '').trim();
    const objections = String(form.get('objections') || '').trim();
    const fundingCapacity = String(form.get('fundingCapacity') || '').trim();
    const referralPath = String(form.get('referralPath') || '').trim();

    try {
      await prisma.dealContact.updateMany({
        where: { id: params.linkId, dealId: params.id, userId },
        data: {
          relationshipType: normaliseDealRelationshipType(form.get('relationshipType')) as any,
          label: label || null,
          notesEnc: notes ? encrypt(notes, 'deal_contact.notes') : null,
          stage: normaliseDealContactStage(form.get('stage')) as any,
          interestLevel: normaliseDealContactInterest(form.get('interestLevel')) as any,
          confidentialityStage: normaliseDealConfidentiality(form.get('confidentialityStage')) as any,
          nextActionEnc: nextAction ? encrypt(nextAction, 'deal_contact.next_action') : null,
          nextFollowUpAt: parseDateTime(form.get('nextFollowUpAt')),
          lastContactedAt: parseDateTime(form.get('lastContactedAt')),
          buyingCriteriaEnc: buyingCriteria ? encrypt(buyingCriteria, 'deal_contact.buying_criteria') : null,
          objectionsEnc: objections ? encrypt(objections, 'deal_contact.objections') : null,
          fundingCapacityEnc: fundingCapacity ? encrypt(fundingCapacity, 'deal_contact.funding_capacity') : null,
          referralPathEnc: referralPath ? encrypt(referralPath, 'deal_contact.referral_path') : null
        }
      });
    } catch (err) {
      console.error('[deal-thread:save] failed', err);
      return fail(500, { error: 'Could not save deal relationship.' });
    }

    throw redirect(303, `/deals/${params.id}/relationships/${params.linkId}`);
  },

  updateNote: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const link = await loadOwnedLink(userId, params.id, params.linkId);
    if (!link) return fail(404, { error: 'Deal relationship not found.' });

    const form = await request.formData();
    const noteId = String(form.get('noteId') || '');
    const text = String(form.get('text') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    if (!noteId || !text) return fail(400, { error: 'Note text is required.' });

    await prisma.dealContactNote.updateMany({
      where: { id: noteId, userId, dealContactId: link.id },
      data: {
        occurredAt: parseDateTime(form.get('occurredAt')) || new Date(),
        channel: normaliseNoteChannel(form.get('channel')),
        rawTextEnc: encrypt(text, 'deal_contact_note.raw_text'),
        summaryEnc: summary ? encrypt(summary, 'deal_contact_note.summary') : null
      }
    });

    throw redirect(303, `/deals/${params.id}/relationships/${params.linkId}`);
  },

  markContactedToday: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await prisma.dealContact.updateMany({ where: { id: params.linkId, dealId: params.id, userId: locals.user.id }, data: { lastContactedAt: new Date() } });
    throw redirect(303, `/deals/${params.id}/relationships/${params.linkId}`);
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;

    const link = await loadOwnedLink(userId, params.id, params.linkId);
    if (!link) return fail(404, { error: 'Deal relationship not found.' });

    const form = await request.formData();
    const result = await createTaskFromForm(userId, form, {
      contactId: link.contactId,
      dealId: link.dealId,
      dealContactId: link.id
    });
    if (!result.ok) return fail(result.status, { error: result.error });

    throw redirect(303, `/deals/${params.id}/relationships/${params.linkId}`);
  },

  updateTaskStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });
    await prisma.task.updateMany({
      where: { id: taskId, userId: locals.user.id, dealContactId: params.linkId },
      data: { status, completedAt: status === 'DONE' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null }
    });
    throw redirect(303, `/deals/${params.id}/relationships/${params.linkId}`);
  }
};

// src/routes/deals/[id]/relationships/[linkId]/+page.server.ts
// PURPOSE: Manage one commercial conversation thread between one person and one deal.
// SECURITY: All reads and writes are scoped by userId and dealId/linkId.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { DEAL_RELATIONSHIP_TYPES, dealRelationshipLabel, normaliseDealRelationshipType, safeDecrypt } from '$lib/deals';
import {
  DEAL_CONFIDENTIALITY_STAGES,
  DEAL_CONTACT_INTERESTS,
  DEAL_CONTACT_STAGES,
  PROJECT_STATUSES,
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
  normaliseTaskImportance,
  normaliseTaskStatus,
  normaliseTaskType,
  normaliseTaskUrgency,
  parseDateTime,
  projectStatusLabel,
  safeDecryptTask,
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
      occurredAt: note.occurredAt,
      preview: previewSource.length > 320 ? `${previewSource.slice(0, 317)}...` : previewSource,
      summary
    };
  });

  const tasksRaw = await prisma.task.findMany({
    where: { userId, dealContactId: link.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
    select: {
      id: true, titleEnc: true, notesEnc: true, status: true, urgency: true, importance: true, taskType: true, dueAt: true,
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      project: { select: { id: true, titleEnc: true, status: true } }
    },
    orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }]
  });

  const tasks = await Promise.all(tasksRaw.map(async (task: any) => ({
    id: task.id,
    title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
    notes: safeDecryptTask(task.notesEnc, 'task.notes', ''),
    status: task.status,
    statusLabel: taskStatusLabel(task.status),
    urgency: task.urgency,
    urgencyLabel: taskUrgencyLabel(task.urgency),
    importanceLabel: taskImportanceLabel(task.importance),
    taskTypeLabel: taskTypeLabel(task.taskType),
    dueAt: task.dueAt,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
    project: task.project ? { id: task.project.id, title: safeDecryptTask(task.project.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(task.project.status) } : null
  })));

  const projectsRaw = await prisma.project.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any } },
    select: { id: true, titleEnc: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });

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
    relationshipOptions: DEAL_RELATIONSHIP_TYPES,
    dealContactStageOptions: DEAL_CONTACT_STAGES,
    dealContactInterestOptions: DEAL_CONTACT_INTERESTS,
    dealConfidentialityOptions: DEAL_CONFIDENTIALITY_STAGES,
    taskStatusOptions: TASK_STATUSES,
    taskUrgencyOptions: TASK_URGENCIES,
    taskImportanceOptions: TASK_IMPORTANCES,
    taskTypeOptions: TASK_TYPES,
    projectStatusOptions: PROJECT_STATUSES,
    projectOptions: projectsRaw.map((p: any) => ({ id: p.id, title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(p.status) }))
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

  markContactedToday: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await prisma.dealContact.updateMany({ where: { id: params.linkId, dealId: params.id, userId: locals.user.id }, data: { lastContactedAt: new Date() } });
    throw redirect(303, `/deals/${params.id}/relationships/${params.linkId}`);
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Task title is required.' });

    const link = await loadOwnedLink(userId, params.id, params.linkId);
    if (!link) return fail(404, { error: 'Deal relationship not found.' });

    const projectId = String(form.get('projectId') || '').trim() || null;
    if (projectId) {
      const ok = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
      if (!ok) return fail(404, { error: 'Project not found.' });
    }

    const notes = String(form.get('notes') || '').trim();
    await prisma.task.create({
      data: {
        userId,
        titleEnc: encrypt(title, 'task.title'),
        notesEnc: notes ? encrypt(notes, 'task.notes') : null,
        status: normaliseTaskStatus(form.get('status')) as any,
        urgency: normaliseTaskUrgency(form.get('urgency')) as any,
        importance: normaliseTaskImportance(form.get('importance')) as any,
        taskType: normaliseTaskType(form.get('taskType')) as any,
        dueAt: parseDateTime(form.get('dueAt')),
        dealId: link.dealId,
        contactId: link.contactId,
        dealContactId: link.id,
        waitingOnContactId: String(form.get('waitingOnThisPerson') || '') === 'on' ? link.contactId : null,
        projectId
      }
    });

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

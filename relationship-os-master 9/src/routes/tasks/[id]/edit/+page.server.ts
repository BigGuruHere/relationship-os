// src/routes/tasks/[id]/edit/+page.server.ts
// PURPOSE: Edit one unified task, including voice-transcribed notes and AI summary.
// SECURITY: Every task read/write and every linked object check is scoped to locals.user.id.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { companyDisplay } from '$lib/companies';
import { safeDecrypt } from '$lib/deals';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import {
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  dateTimeToInputValue,
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

async function ownedIdExists(userId: string, kind: 'contact' | 'deal' | 'project' | 'company', id: string | null) {
  if (!id) return true;
  if (kind === 'contact') return !!(await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'deal') return !!(await prisma.deal.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'company') return !!(await prisma.company.findFirst({ where: { id, userId }, select: { id: true } }));
  return !!(await prisma.project.findFirst({ where: { id, userId }, select: { id: true } }));
}

async function loadOptions(userId: string) {
  const [contactsRaw, dealsRaw, projectsRaw, companiesRaw, dealContactsRaw, dealCompaniesRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, kind: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
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
  const projects = projectsRaw.map((project) => ({ id: project.id, title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(project.status) }));
  const companies = companiesRaw.map((company) => ({ id: company.id, name: companyDisplay(company), kind: company.kind, status: company.status }));
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

  return { contacts, deals, projects, companies, dealContacts, dealCompanies };
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const row = await prisma.task.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      titleEnc: true,
      notesEnc: true,
      summaryEnc: true,
      status: true,
      urgency: true,
      importance: true,
      taskType: true,
      dueAt: true,
      snoozedUntil: true,
      contactId: true,
      dealId: true,
      dealContactId: true,
      companyId: true,
      dealCompanyId: true,
      projectId: true,
      assignedToTextEnc: true,
      assignedToContactId: true,
      waitingOnContactId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!row) throw redirect(303, '/tasks');

  return {
    returnTo: String(url.searchParams.get('returnTo') || '/tasks'),
    task: {
      id: row.id,
      title: safeDecryptTask(row.titleEnc, 'task.title', 'Untitled task'),
      notes: safeDecryptTask(row.notesEnc, 'task.notes', ''),
      summary: safeDecryptTask(row.summaryEnc, 'task.summary', ''),
      status: row.status,
      statusLabel: taskStatusLabel(row.status),
      urgency: row.urgency,
      urgencyLabel: taskUrgencyLabel(row.urgency),
      importance: row.importance,
      importanceLabel: taskImportanceLabel(row.importance),
      taskType: row.taskType,
      taskTypeLabel: taskTypeLabel(row.taskType),
      dueAtInput: dateTimeToInputValue(row.dueAt),
      snoozedUntilInput: dateTimeToInputValue(row.snoozedUntil),
      contactId: row.contactId || '',
      dealId: row.dealId || '',
      dealContactId: row.dealContactId || '',
      companyId: row.companyId || '',
      dealCompanyId: row.dealCompanyId || '',
      projectId: row.projectId || '',
      assignedToText: safeDecryptTask(row.assignedToTextEnc, 'task.assigned_to_text', ''),
      assignedToContactId: row.assignedToContactId || '',
      waitingOnContactId: row.waitingOnContactId || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    },
    options: await loadOptions(userId),
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskTypes: TASK_TYPES
  };
};

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const returnTo = String(form.get('returnTo') || '/tasks');

    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Task title is required.' });

    let contactId = String(form.get('contactId') || '').trim() || null;
    let dealId = String(form.get('dealId') || '').trim() || null;
    let dealContactId = String(form.get('dealContactId') || '').trim() || null;
    let companyId = String(form.get('companyId') || '').trim() || null;
    let dealCompanyId = String(form.get('dealCompanyId') || '').trim() || null;
    const projectId = String(form.get('projectId') || '').trim() || null;
    const assignedToContactId = String(form.get('assignedToContactId') || '').trim() || null;
    const waitingOnContactId = String(form.get('waitingOnContactId') || '').trim() || null;

    if (dealContactId) {
      const link = await prisma.dealContact.findFirst({ where: { id: dealContactId, userId }, select: { id: true, dealId: true, contactId: true } });
      if (!link) return fail(404, { error: 'Deal-person thread not found.' });
      dealId = link.dealId;
      contactId = contactId || link.contactId;
    }

    if (dealCompanyId) {
      const link = await prisma.dealCompany.findFirst({ where: { id: dealCompanyId, userId }, select: { id: true, dealId: true, companyId: true } });
      if (!link) return fail(404, { error: 'Deal-company thread not found.' });
      dealId = link.dealId;
      companyId = companyId || link.companyId;
    }

    const [contactOk, dealOk, projectOk, companyOk, assignedOk, waitingOk] = await Promise.all([
      ownedIdExists(userId, 'contact', contactId),
      ownedIdExists(userId, 'deal', dealId),
      ownedIdExists(userId, 'project', projectId),
      ownedIdExists(userId, 'company', companyId),
      ownedIdExists(userId, 'contact', assignedToContactId),
      ownedIdExists(userId, 'contact', waitingOnContactId)
    ]);
    if (!contactOk || !dealOk || !projectOk || !companyOk || !assignedOk || !waitingOk) return fail(404, { error: 'One of the selected links was not found.' });

    const status = normaliseTaskStatus(form.get('status'));
    const notes = String(form.get('notes') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const assignedToText = String(form.get('assignedToText') || '').trim();

    await prisma.task.updateMany({
      where: { id: params.id, userId },
      data: {
        titleEnc: encrypt(title, 'task.title'),
        notesEnc: notes ? encrypt(notes, 'task.notes') : null,
        summaryEnc: summary ? encrypt(summary, 'task.summary') : null,
        status: status as any,
        urgency: normaliseTaskUrgency(form.get('urgency')) as any,
        importance: normaliseTaskImportance(form.get('importance')) as any,
        taskType: normaliseTaskType(form.get('taskType')) as any,
        dueAt: parseDateTime(form.get('dueAt')),
        snoozedUntil: parseDateTime(form.get('snoozedUntil')),
        completedAt: status === 'DONE' ? new Date() : null,
        cancelledAt: status === 'CANCELLED' ? new Date() : null,
        assignedToTextEnc: assignedToText ? encrypt(assignedToText, 'task.assigned_to_text') : null,
        assignedToContactId,
        waitingOnContactId,
        contactId,
        dealId,
        dealContactId,
        companyId,
        dealCompanyId,
        projectId
      }
    });

    throw redirect(303, returnTo);
  }
};

// src/routes/tasks/[id]/+page.server.ts
// PURPOSE: Show one unified task and every entity it is attached to.
// SECURITY: The task read and every quick action are tenant scoped by locals.user.id.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { companyDisplay, companyContactStatusLabel } from '$lib/companies';
import { safeDecrypt } from '$lib/deals';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { marketLeadStatusLabel } from '$lib/marketLeads';
import {
  TASK_FOCUS_OPTIONS,
  TASK_STATUSES,
  normaliseTaskFocus,
  normaliseTaskStatus,
  projectStatusLabel,
  safeDecryptTask,
  taskFocusLabel,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

async function loadTask(userId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, userId },
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
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      assignedToTextEnc: true,
      assignedToContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      deal: { select: { id: true, titleEnc: true, status: true } },
      project: { select: { id: true, titleEnc: true, status: true } },
      workstream: { select: { id: true, nameEnc: true, projectId: true, status: true } },
      marketLead: { select: { id: true, titleEnc: true, type: true, status: true, projectId: true } },
      company: { select: { id: true, nameEnc: true, kind: true, status: true } },
      companyContact: {
        select: {
          id: true,
          titleEnc: true,
          status: true,
          company: { select: { id: true, nameEnc: true, kind: true } },
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      },
      dealCompany: {
        select: {
          id: true,
          label: true,
          deal: { select: { id: true, titleEnc: true } },
          company: { select: { id: true, nameEnc: true, kind: true } }
        }
      },
      dealContact: {
        select: {
          id: true,
          label: true,
          deal: { select: { id: true, titleEnc: true } },
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      }
    }
  });
}

async function mapTask(row: Awaited<ReturnType<typeof loadTask>>) {
  if (!row) return null;

  const title = safeDecryptTask(row.titleEnc, 'task.title', 'Untitled task');
  const notes = safeDecryptTask(row.notesEnc, 'task.notes', '');
  const summary = safeDecryptTask(row.summaryEnc, 'task.summary', '');
  const assignedToText = safeDecryptTask(row.assignedToTextEnc, 'task.assigned_to_text', '');

  const [
    contactName,
    assignedContactName,
    waitingName,
    companyContactContactName,
    dealContactContactName
  ] = await Promise.all([
    row.contact ? contactDisplayName(row.contact) : Promise.resolve(''),
    row.assignedToContact ? contactDisplayName(row.assignedToContact) : Promise.resolve(''),
    row.waitingOnContact ? contactDisplayName(row.waitingOnContact) : Promise.resolve(''),
    row.companyContact?.contact ? contactDisplayName(row.companyContact.contact) : Promise.resolve(''),
    row.dealContact?.contact ? contactDisplayName(row.dealContact.contact) : Promise.resolve('')
  ]);

  const dealTitle = row.deal ? safeDecrypt(row.deal.titleEnc, 'deal.title', 'Untitled deal') : '';
  const projectTitle = row.project ? safeDecryptTask(row.project.titleEnc, 'project.title', 'Untitled project') : '';
  const workstreamName = row.workstream ? safeDecryptTask(row.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream') : '';
  const marketLeadTitle = row.marketLead ? safeDecryptTask(row.marketLead.titleEnc, 'market_lead.title', 'Untitled lead') : '';
  const companyName = row.company ? companyDisplay(row.company) : '';
  const companyContactTitle = row.companyContact ? safeDecrypt(row.companyContact.titleEnc, 'company_contact.title', '') : '';
  const companyContactCompanyName = row.companyContact?.company ? companyDisplay(row.companyContact.company) : '';
  const dealCompanyDealTitle = row.dealCompany?.deal ? safeDecrypt(row.dealCompany.deal.titleEnc, 'deal.title', 'Untitled deal') : '';
  const dealCompanyName = row.dealCompany?.company ? companyDisplay(row.dealCompany.company) : '';
  const dealContactDealTitle = row.dealContact?.deal ? safeDecrypt(row.dealContact.deal.titleEnc, 'deal.title', 'Untitled deal') : '';

  return {
    id: row.id,
    title,
    notes,
    summary,
    status: row.status,
    statusLabel: taskStatusLabel(row.status),
    urgency: row.urgency,
    urgencyLabel: taskUrgencyLabel(row.urgency),
    importance: row.importance,
    importanceLabel: taskImportanceLabel(row.importance),
    focus: row.focus,
    focusLabel: taskFocusLabel(row.focus),
    taskType: row.taskType,
    taskTypeLabel: taskTypeLabel(row.taskType),
    dueAt: row.dueAt,
    snoozedUntil: row.snoozedUntil,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignedToText,
    assignedToContact: row.assignedToContact ? { id: row.assignedToContact.id, name: assignedContactName } : null,
    waitingOnContact: row.waitingOnContact ? { id: row.waitingOnContact.id, name: waitingName } : null,
    contact: row.contact ? { id: row.contact.id, name: contactName } : null,
    deal: row.deal ? { id: row.deal.id, title: dealTitle, status: row.deal.status } : null,
    project: row.project ? { id: row.project.id, title: projectTitle, statusLabel: projectStatusLabel(row.project.status) } : null,
    workstream: row.workstream ? { id: row.workstream.id, name: workstreamName, projectId: row.workstream.projectId } : null,
    marketLead: row.marketLead ? { id: row.marketLead.id, title: marketLeadTitle, statusLabel: marketLeadStatusLabel(row.marketLead.status) } : null,
    company: row.company ? { id: row.company.id, name: companyName } : null,
    companyContact: row.companyContact ? {
      id: row.companyContact.id,
      companyId: row.companyContact.company.id,
      contactId: row.companyContact.contact.id,
      companyName: companyContactCompanyName,
      contactName: companyContactContactName,
      title: companyContactTitle,
      statusLabel: companyContactStatusLabel(row.companyContact.status)
    } : null,
    dealCompany: row.dealCompany ? {
      id: row.dealCompany.id,
      dealId: row.dealCompany.deal.id,
      companyId: row.dealCompany.company.id,
      label: row.dealCompany.label || '',
      dealTitle: dealCompanyDealTitle,
      companyName: dealCompanyName
    } : null,
    dealContact: row.dealContact ? {
      id: row.dealContact.id,
      dealId: row.dealContact.deal.id,
      contactId: row.dealContact.contact.id,
      label: row.dealContact.label || '',
      dealTitle: dealContactDealTitle,
      contactName: dealContactContactName
    } : null
  };
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await loadTask(locals.user.id, params.id);
  if (!row) throw redirect(303, '/tasks');

  return {
    task: await mapTask(row),
    taskStatuses: TASK_STATUSES,
    taskFocusOptions: TASK_FOCUS_OPTIONS
  };
};

export const actions: Actions = {
  updateStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const status = normaliseTaskStatus(form.get('status'));

    const data: any = { status };
    data.completedAt = status === 'DONE' ? new Date() : null;
    data.cancelledAt = status === 'CANCELLED' ? new Date() : null;

    const res = await prisma.task.updateMany({ where: { id: params.id, userId: locals.user.id }, data });
    if (!res.count) return fail(404, { error: 'Task not found.' });

    throw redirect(303, `/tasks/${params.id}`);
  },

  updateFocus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const focus = normaliseTaskFocus(form.get('focus'));

    const res = await prisma.task.updateMany({ where: { id: params.id, userId: locals.user.id }, data: { focus: focus as any } });
    if (!res.count) return fail(404, { error: 'Task not found.' });

    throw redirect(303, `/tasks/${params.id}`);
  },

  delete: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await prisma.task.deleteMany({ where: { id: params.id, userId: locals.user.id } });
    throw redirect(303, '/tasks');
  }
};

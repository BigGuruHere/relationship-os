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
import { loadWant } from '$lib/server/wants';
import { loadOffer } from '$lib/server/offers';
import { completeTaskAndAdvanceRecurrence, parseRecurrenceRule, recurrenceFields, recurrenceLabel } from '$lib/server/taskRecurrence';
import {
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  dateTimeToInputValue,
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

async function ownedIdExists(userId: string, kind: 'contact' | 'deal' | 'project' | 'company' | 'workstream' | 'want' | 'offer', id: string | null) {
  if (!id) return true;
  if (kind === 'contact') return !!(await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'deal') return !!(await prisma.deal.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'company') return !!(await prisma.company.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'workstream') return !!(await prisma.projectWorkstream.findFirst({ where: { id, userId, status: { not: 'ARCHIVED' as any } }, select: { id: true } }));
  if (kind === 'want') return !!(await prisma.want.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'offer') return !!(await prisma.offer.findFirst({ where: { id, userId }, select: { id: true } }));
  return !!(await prisma.project.findFirst({ where: { id, userId }, select: { id: true } }));
}

async function loadOptions(userId: string) {
  const [contactsRaw, dealsRaw, projectsRaw, companiesRaw, workstreamsRaw, dealContactsRaw, dealCompaniesRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, kind: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.projectWorkstream.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any }, project: { status: { not: 'ARCHIVED' as any } } },
      select: { id: true, nameEnc: true, status: true, projectId: true, project: { select: { id: true, titleEnc: true } } },
      orderBy: [{ project: { updatedAt: 'desc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 300
    }),
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
  const workstreams = workstreamsRaw.map((workstream) => {
    const name = safeDecryptTask(workstream.nameEnc, 'project_workstream.name', 'Untitled workstream');
    const projectTitle = safeDecryptTask(workstream.project.titleEnc, 'project.title', 'Untitled project');
    return { id: workstream.id, projectId: workstream.projectId, name, projectTitle, title: `${projectTitle} - ${name}`, status: workstream.status };
  });
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

  return { contacts, deals, projects, companies, workstreams, dealContacts, dealCompanies };
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
      focus: true,
      taskType: true,
      dueAt: true,
      snoozedUntil: true,
      contactId: true,
      dealId: true,
      dealContactId: true,
      companyId: true,
      dealCompanyId: true,
      projectId: true,
      workstreamId: true,
      wantId: true,
      offerId: true,
      assignedToTextEnc: true,
      assignedToContactId: true,
      waitingOnContactId: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!row) throw redirect(303, '/tasks');

  // IT: Only load the already-linked Want/Offer for the collapsed summary. Ranked suggestions are
  // fetched lazily from the authenticated endpoint only when the user expands an attachment panel.
  const [options, linkedWant, linkedOffer] = await Promise.all([
    loadOptions(userId),
    row.wantId ? loadWant(userId, row.wantId) : Promise.resolve(null),
    row.offerId ? loadOffer(userId, row.offerId) : Promise.resolve(null)
  ]);

  const pickerItem = (kind: 'want' | 'offer', item: any) => item ? ({
    id: item.id,
    title: item.title,
    status: item.status,
    statusLabel: item.statusLabel,
    typeLabel: kind === 'want' ? item.wantTypeLabel : item.offerTypeLabel,
    contactName: item.contact?.name || '',
    companyName: item.company?.name || '',
    projectTitle: item.project?.title || '',
    workstreamName: item.workstream?.name || '',
    reasons: ['currently linked']
  }) : null;

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
      focus: row.focus,
      focusLabel: taskFocusLabel(row.focus),
      taskType: row.taskType,
      taskTypeLabel: taskTypeLabel(row.taskType),
      dueAtInput: dateTimeToInputValue(row.dueAt),
      snoozedUntilInput: dateTimeToInputValue(row.snoozedUntil),
      recurrenceRule: row.recurrenceRule,
      recurrenceLabel: recurrenceLabel(row.recurrenceRule),
      contactId: row.contactId || '',
      dealId: row.dealId || '',
      dealContactId: row.dealContactId || '',
      companyId: row.companyId || '',
      dealCompanyId: row.dealCompanyId || '',
      projectId: row.projectId || '',
      workstreamId: row.workstreamId || '',
      wantId: row.wantId || '',
      offerId: row.offerId || '',
      assignedToText: safeDecryptTask(row.assignedToTextEnc, 'task.assigned_to_text', ''),
      assignedToContactId: row.assignedToContactId || '',
      waitingOnContactId: row.waitingOnContactId || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    },
    options,
    linkedWant: pickerItem('want', linkedWant),
    linkedOffer: pickerItem('offer', linkedOffer),
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
    const form = await request.formData();
    const returnTo = String(form.get('returnTo') || '/tasks');

    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Task title is required.' });

    let contactId = String(form.get('contactId') || '').trim() || null;
    let dealId = String(form.get('dealId') || '').trim() || null;
    let dealContactId = String(form.get('dealContactId') || '').trim() || null;
    let companyId = String(form.get('companyId') || '').trim() || null;
    let dealCompanyId = String(form.get('dealCompanyId') || '').trim() || null;
    let projectId = String(form.get('projectId') || '').trim() || null;
    let workstreamId = String(form.get('workstreamId') || '').trim() || null;
    const wantId = String(form.get('wantId') || '').trim() || null;
    const offerId = String(form.get('offerId') || '').trim() || null;
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

    // IT: A linked Want/Offer can supply missing task context, but never silently override an
    // explicit conflicting person/company/deal/project/workstream chosen by the user.
    if (wantId) {
      const want = await prisma.want.findFirst({
        where: { id: wantId, userId },
        select: { id: true, contactId: true, companyId: true, dealId: true, projectId: true, workstreamId: true }
      });
      if (!want) return fail(404, { error: 'Selected Want was not found.' });
      if (contactId && want.contactId && contactId !== want.contactId) return fail(400, { error: 'Selected Want belongs to a different person.' });
      if (companyId && want.companyId && companyId !== want.companyId) return fail(400, { error: 'Selected Want belongs to a different company.' });
      if (dealId && want.dealId && dealId !== want.dealId) return fail(400, { error: 'Selected Want belongs to a different deal.' });
      if (projectId && want.projectId && projectId !== want.projectId) return fail(400, { error: 'Selected Want belongs to a different project.' });
      if (workstreamId && want.workstreamId && workstreamId !== want.workstreamId) return fail(400, { error: 'Selected Want belongs to a different workstream.' });
      contactId = contactId || want.contactId;
      companyId = companyId || want.companyId;
      dealId = dealId || want.dealId;
      projectId = projectId || want.projectId;
      workstreamId = workstreamId || want.workstreamId;
    }

    if (offerId) {
      const offer = await prisma.offer.findFirst({
        where: { id: offerId, userId },
        select: { id: true, contactId: true, companyId: true, dealId: true, projectId: true, workstreamId: true }
      });
      if (!offer) return fail(404, { error: 'Selected Offer was not found.' });
      if (contactId && offer.contactId && contactId !== offer.contactId) return fail(400, { error: 'Selected Offer belongs to a different person.' });
      if (companyId && offer.companyId && companyId !== offer.companyId) return fail(400, { error: 'Selected Offer belongs to a different company.' });
      if (dealId && offer.dealId && dealId !== offer.dealId) return fail(400, { error: 'Selected Offer belongs to a different deal.' });
      if (projectId && offer.projectId && projectId !== offer.projectId) return fail(400, { error: 'Selected Offer belongs to a different project.' });
      if (workstreamId && offer.workstreamId && workstreamId !== offer.workstreamId) return fail(400, { error: 'Selected Offer belongs to a different workstream.' });
      contactId = contactId || offer.contactId;
      companyId = companyId || offer.companyId;
      dealId = dealId || offer.dealId;
      projectId = projectId || offer.projectId;
      workstreamId = workstreamId || offer.workstreamId;
    }

    if (workstreamId) {
      const workstream = await prisma.projectWorkstream.findFirst({
        where: { id: workstreamId, userId, status: { not: 'ARCHIVED' as any }, project: { status: { not: 'ARCHIVED' as any } } },
        select: { id: true, projectId: true }
      });
      if (!workstream) return fail(404, { error: 'Selected workstream was not found.' });
      if (projectId && projectId !== workstream.projectId) return fail(400, { error: 'Selected workstream does not belong to the selected project.' });
      projectId = projectId || workstream.projectId;
    }

    const [contactOk, dealOk, projectOk, companyOk, wantOk, offerOk, assignedOk, waitingOk] = await Promise.all([
      ownedIdExists(userId, 'contact', contactId),
      ownedIdExists(userId, 'deal', dealId),
      ownedIdExists(userId, 'project', projectId),
      ownedIdExists(userId, 'company', companyId),
      ownedIdExists(userId, 'want', wantId),
      ownedIdExists(userId, 'offer', offerId),
      ownedIdExists(userId, 'contact', assignedToContactId),
      ownedIdExists(userId, 'contact', waitingOnContactId)
    ]);
    if (!contactOk || !dealOk || !projectOk || !companyOk || !wantOk || !offerOk || !assignedOk || !waitingOk) return fail(404, { error: 'One of the selected links was not found.' });

    const status = normaliseTaskStatus(form.get('status'));
    const dueAt = parseDateTime(form.get('dueAt'));
    const recurrenceRule = parseRecurrenceRule(form.get('recurrenceRule'));
    if (recurrenceRule && !dueAt) return fail(400, { error: 'A due date is required for a recurring task.' });
    const existingTask = await prisma.task.findFirst({ where: { id: params.id, userId }, select: { recurrenceSeriesId: true, recurrenceAnchorAt: true } });
    if (!existingTask) return fail(404, { error: 'Task not found.' });
    const recurrence = recurrenceFields(recurrenceRule, dueAt, existingTask.recurrenceSeriesId, dueAt || existingTask.recurrenceAnchorAt);
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
        focus: normaliseTaskFocus(form.get('focus')) as any,
        taskType: normaliseTaskType(form.get('taskType')) as any,
        dueAt,
        ...recurrence,
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
        projectId,
        workstreamId,
        wantId,
        offerId
      }
    });

    if (!recurrenceRule && existingTask.recurrenceSeriesId) {
      // IT: Choosing Never means stop the whole series. Keep any already-created future task as a
      // normal one-off task rather than silently deleting user work.
      await prisma.task.updateMany({
        where: {
          userId,
          recurrenceSeriesId: existingTask.recurrenceSeriesId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any }
        },
        data: { recurrenceRule: null, recurrenceSeriesId: null, recurrenceAnchorAt: null }
      });
    }

    if (status === 'DONE') {
      // IT: The edit action uses the same recurrence engine as the task list/detail quick action.
      // The task is already marked DONE above, so only create the next occurrence if it did not exist.
      const completed = await completeTaskAndAdvanceRecurrence(userId, params.id);
      if (!completed.found) return fail(404, { error: 'Task not found.' });
    }

    if (projectId && dealId) {
      await prisma.projectDeal.upsert({
        where: { projectId_dealId: { projectId, dealId } },
        update: workstreamId ? { workstreamId } : {},
        create: { userId, projectId, dealId, workstreamId }
      }).catch(() => null);
    }

    throw redirect(303, returnTo);
  }
};

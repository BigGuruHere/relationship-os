// src/routes/tasks/+page.server.ts
// PURPOSE: Unified task inbox for relationship, deal, deal-contact, and project work.
// SECURITY: All reads and writes are tenant scoped by locals.user.id. Task text is encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import { safeDecrypt } from '$lib/deals';
import {
  PROJECT_STATUSES,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  normaliseProjectStatus,
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

const ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];

type TaskRow = any;

async function loadTaskRows(userId: string, status: string, q: string) {
  const where: any = { userId };
  if (status && TASK_STATUSES.some((s) => s.value === status)) {
    where.status = status;
  } else if (status !== 'ALL') {
    where.status = { in: ACTIVE_STATUSES };
  }

  // IT: encrypted search is bounded and performed after decrypting below.
  return prisma.task.findMany({
    where,
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
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      assignedToTextEnc: true,
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      assignedToContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      deal: { select: { id: true, titleEnc: true, status: true } },
      project: { select: { id: true, titleEnc: true, status: true } },
      dealContact: {
        select: {
          id: true,
          label: true,
          relationshipType: true,
          deal: { select: { id: true, titleEnc: true } },
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      }
    },
    orderBy: [{ dueAt: 'asc' }, { urgency: 'desc' }, { updatedAt: 'desc' }],
    take: 300
  });
}

async function mapTask(row: TaskRow) {
  const title = safeDecryptTask(row.titleEnc, 'task.title', 'Untitled task');
  const notes = safeDecryptTask(row.notesEnc, 'task.notes', '');
  const summary = safeDecryptTask(row.summaryEnc, 'task.summary', '');
  const assignedToText = safeDecryptTask(row.assignedToTextEnc, 'task.assigned_to_text', '');
  const contactName = row.contact ? await contactDisplayName(row.contact) : '';
  const assignedContactName = row.assignedToContact ? await contactDisplayName(row.assignedToContact) : '';
  const waitingName = row.waitingOnContact ? await contactDisplayName(row.waitingOnContact) : '';
  const dealTitle = row.deal ? safeDecrypt(row.deal.titleEnc, 'deal.title', 'Untitled deal') : '';
  const projectTitle = row.project ? safeDecryptTask(row.project.titleEnc, 'project.title', 'Untitled project') : '';
  const threadContactName = row.dealContact?.contact ? await contactDisplayName(row.dealContact.contact) : '';
  const threadDealTitle = row.dealContact?.deal ? safeDecrypt(row.dealContact.deal.titleEnc, 'deal.title', 'Untitled deal') : '';

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
    taskType: row.taskType,
    taskTypeLabel: taskTypeLabel(row.taskType),
    dueAt: row.dueAt,
    snoozedUntil: row.snoozedUntil,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignedToText,
    contact: row.contact ? { id: row.contact.id, name: contactName } : null,
    assignedToContact: row.assignedToContact ? { id: row.assignedToContact.id, name: assignedContactName } : null,
    waitingOnContact: row.waitingOnContact ? { id: row.waitingOnContact.id, name: waitingName } : null,
    deal: row.deal ? { id: row.deal.id, title: dealTitle, status: row.deal.status } : null,
    project: row.project ? { id: row.project.id, title: projectTitle, statusLabel: projectStatusLabel(row.project.status) } : null,
    dealContact: row.dealContact ? {
      id: row.dealContact.id,
      dealId: row.dealContact.deal.id,
      contactId: row.dealContact.contact.id,
      label: row.dealContact.label || '',
      dealTitle: threadDealTitle,
      contactName: threadContactName
    } : null
  };
}

function taskMatchesQuery(task: Awaited<ReturnType<typeof mapTask>>, q: string) {
  if (!q) return true;
  const haystack = [
    task.title,
    task.notes,
    task.summary,
    task.contact?.name,
    task.deal?.title,
    task.project?.title,
    task.waitingOnContact?.name,
    task.assignedToContact?.name,
    task.assignedToText,
    task.dealContact?.dealTitle,
    task.dealContact?.contactName
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q.toLowerCase());
}

async function loadOptions(userId: string) {
  const [contactsRaw, dealsRaw, projectsRaw, dealContactsRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
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
    })
  ]);

  const contacts = await contactOptionsForRows(contactsRaw as any);
  const deals = dealsRaw.map((d) => ({ id: d.id, title: safeDecrypt(d.titleEnc, 'deal.title', 'Untitled deal'), status: d.status }));
  const projects = projectsRaw.map((p) => ({ id: p.id, title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(p.status) }));
  const dealContacts = await Promise.all(dealContactsRaw.map(async (link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    contactId: link.contact.id,
    label: link.label || '',
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${await contactDisplayName(link.contact)}${link.label ? ` (${link.label})` : ''}`
  })));

  return { contacts, deals, projects, dealContacts };
}

async function ownedIdExists(userId: string, kind: 'contact' | 'deal' | 'project', id: string | null) {
  if (!id) return true;
  if (kind === 'contact') return !!(await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'deal') return !!(await prisma.deal.findFirst({ where: { id, userId }, select: { id: true } }));
  return !!(await prisma.project.findFirst({ where: { id, userId }, select: { id: true } }));
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const userId = locals.user.id;
  const status = String(url.searchParams.get('status') || '').trim().toUpperCase();
  const q = String(url.searchParams.get('q') || '').trim();

  const rows = await loadTaskRows(userId, status, q);
  const mapped = await Promise.all(rows.map(mapTask));
  const tasks = mapped.filter((task) => taskMatchesQuery(task, q));

  const now = new Date();
  const startTomorrow = new Date(now);
  startTomorrow.setHours(24, 0, 0, 0);

  const summary = {
    open: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any } } }),
    waiting: await prisma.task.count({ where: { userId, status: 'WAITING' as any } }),
    overdue: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any }, dueAt: { lt: now } } }),
    today: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any }, dueAt: { gte: now, lt: startTomorrow } } })
  };

  return {
    q,
    selectedStatus: status || '',
    tasks,
    summary,
    options: await loadOptions(userId),
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskTypes: TASK_TYPES,
    projectStatuses: PROJECT_STATUSES
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();

    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Task title is required.' });

    let contactId = String(form.get('contactId') || '').trim() || null;
    let dealId = String(form.get('dealId') || '').trim() || null;
    let dealContactId = String(form.get('dealContactId') || '').trim() || null;
    const projectId = String(form.get('projectId') || '').trim() || null;
    const assignedToContactId = String(form.get('assignedToContactId') || '').trim() || null;
    const waitingOnContactId = String(form.get('waitingOnContactId') || '').trim() || null;

    if (dealContactId) {
      const link = await prisma.dealContact.findFirst({ where: { id: dealContactId, userId }, select: { id: true, dealId: true, contactId: true } });
      if (!link) return fail(404, { error: 'Deal relationship not found.' });
      dealId = link.dealId;
      contactId = link.contactId;
    }

    const [contactOk, dealOk, projectOk, assignedOk, waitingOk] = await Promise.all([
      ownedIdExists(userId, 'contact', contactId),
      ownedIdExists(userId, 'deal', dealId),
      ownedIdExists(userId, 'project', projectId),
      ownedIdExists(userId, 'contact', assignedToContactId),
      ownedIdExists(userId, 'contact', waitingOnContactId)
    ]);
    if (!contactOk || !dealOk || !projectOk || !assignedOk || !waitingOk) return fail(404, { error: 'One of the selected links was not found.' });

    const notes = String(form.get('notes') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const assignedToText = String(form.get('assignedToText') || '').trim();

    try {
      await prisma.task.create({
        data: {
          userId,
          titleEnc: encrypt(title, 'task.title'),
          notesEnc: notes ? encrypt(notes, 'task.notes') : null,
          summaryEnc: summary ? encrypt(summary, 'task.summary') : null,
          status: normaliseTaskStatus(form.get('status')) as any,
          urgency: normaliseTaskUrgency(form.get('urgency')) as any,
          importance: normaliseTaskImportance(form.get('importance')) as any,
          taskType: normaliseTaskType(form.get('taskType')) as any,
          dueAt: parseDateTime(form.get('dueAt')),
          snoozedUntil: parseDateTime(form.get('snoozedUntil')),
          assignedToTextEnc: assignedToText ? encrypt(assignedToText, 'task.assigned_to_text') : null,
          assignedToContactId,
          waitingOnContactId,
          contactId,
          dealId,
          dealContactId,
          projectId
        }
      });
    } catch (err) {
      console.error('[tasks:create] failed', err);
      return fail(500, { error: 'Could not create task.' });
    }

    throw redirect(303, '/tasks');
  },

  updateStatus: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });

    const data: any = { status };
    if (status === 'DONE') data.completedAt = new Date();
    else data.completedAt = null;
    if (status === 'CANCELLED') data.cancelledAt = new Date();
    else data.cancelledAt = null;

    try {
      const res = await prisma.task.updateMany({ where: { id: taskId, userId: locals.user.id }, data });
      if (!res.count) return fail(404, { error: 'Task not found.' });
    } catch (err) {
      console.error('[tasks:updateStatus] failed', err);
      return fail(500, { error: 'Could not update task.' });
    }

    throw redirect(303, '/tasks');
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    if (!taskId) return fail(400, { error: 'Missing task id.' });

    await prisma.task.deleteMany({ where: { id: taskId, userId: locals.user.id } });
    throw redirect(303, '/tasks');
  },

  createProject: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const title = String(form.get('projectTitle') || '').trim();
    if (!title) return fail(400, { error: 'Project title is required.' });
    const description = String(form.get('projectDescription') || '').trim();

    await prisma.project.create({
      data: {
        userId: locals.user.id,
        titleEnc: encrypt(title, 'project.title'),
        titleIdx: buildIndexToken(title),
        descriptionEnc: description ? encrypt(description, 'project.description') : null,
        status: normaliseProjectStatus(form.get('projectStatus')) as any
      }
    });

    throw redirect(303, '/tasks');
  }
};

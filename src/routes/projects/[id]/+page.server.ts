// src/routes/projects/[id]/+page.server.ts
// PURPOSE: Project command-centre page showing the tasks, people, deals, and waiting items connected to one workstream.
// SECURITY: Every read/write is tenant scoped by locals.user.id. Project/task text is encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { safeDecrypt } from '$lib/deals';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
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

const ACTIVE_TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];

async function loadOptions(userId: string) {
  const [contactsRaw, dealsRaw, dealContactsRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
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
  const deals = dealsRaw.map((deal) => ({ id: deal.id, title: safeDecrypt(deal.titleEnc, 'deal.title', 'Untitled deal'), status: deal.status }));
  const dealContacts = await Promise.all(dealContactsRaw.map(async (link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    contactId: link.contact.id,
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${await contactDisplayName(link.contact)}${link.label ? ` (${link.label})` : ''}`
  })));

  return { contacts, deals, dealContacts };
}

async function ownedIdExists(userId: string, kind: 'contact' | 'deal', id: string | null) {
  if (!id) return true;
  if (kind === 'contact') return !!(await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } }));
  return !!(await prisma.deal.findFirst({ where: { id, userId }, select: { id: true } }));
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!project) throw redirect(303, '/projects');

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
      taskType: true,
      dueAt: true,
      snoozedUntil: true,
      completedAt: true,
      updatedAt: true,
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      assignedToContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      deal: { select: { id: true, titleEnc: true, status: true } },
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
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
    take: 300
  });

  const tasks = await Promise.all(tasksRaw.map(async (task: any) => {
    const dealFromTask = task.deal || task.dealContact?.deal || null;
    const contactFromThread = task.dealContact?.contact || null;
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
      taskTypeLabel: taskTypeLabel(task.taskType),
      dueAt: task.dueAt,
      snoozedUntil: task.snoozedUntil,
      completedAt: task.completedAt,
      updatedAt: task.updatedAt,
      contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
      assignedToContact: task.assignedToContact ? { id: task.assignedToContact.id, name: await contactDisplayName(task.assignedToContact) } : null,
      waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
      deal: dealFromTask ? { id: dealFromTask.id, title: safeDecrypt(dealFromTask.titleEnc, 'deal.title', 'Untitled deal'), status: dealFromTask.status } : null,
      dealContact: task.dealContact ? { id: task.dealContact.id, dealId: task.dealContact.dealId, contactId: task.dealContact.contactId, contactName: await contactDisplayName(contactFromThread) } : null
    };
  }));

  const now = new Date();
  const summary = {
    active: tasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length,
    waiting: tasks.filter((task) => task.status === 'WAITING').length,
    overdue: tasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status) && task.dueAt && new Date(task.dueAt).getTime() < now.getTime()).length,
    completed: tasks.filter((task) => task.status === 'DONE').length
  };

  const dealMap = new Map<string, any>();
  const peopleMap = new Map<string, any>();
  for (const task of tasks) {
    if (task.deal) dealMap.set(task.deal.id, task.deal);
    for (const person of [task.contact, task.assignedToContact, task.waitingOnContact]) {
      if (person) peopleMap.set(person.id, person);
    }
    if (task.dealContact) peopleMap.set(task.dealContact.contactId, { id: task.dealContact.contactId, name: task.dealContact.contactName });
  }

  return {
    project: {
      id: project.id,
      title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'),
      description: safeDecryptTask(project.descriptionEnc, 'project.description', ''),
      status: project.status,
      statusLabel: projectStatusLabel(project.status),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    },
    summary,
    tasks,
    relatedDeals: [...dealMap.values()],
    relatedPeople: [...peopleMap.values()],
    options: await loadOptions(userId),
    projectStatuses: PROJECT_STATUSES,
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskTypes: TASK_TYPES
  };
};

export const actions: Actions = {
  updateProject: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Project title is required.' });
    const description = String(form.get('description') || '').trim();

    await prisma.project.updateMany({
      where: { id: params.id, userId: locals.user.id },
      data: {
        titleEnc: encrypt(title, 'project.title'),
        titleIdx: buildIndexToken(title),
        descriptionEnc: description ? encrypt(description, 'project.description') : null,
        status: normaliseProjectStatus(form.get('status')) as any
      }
    });

    throw redirect(303, `/projects/${params.id}`);
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Task title is required.' });

    let contactId = String(form.get('contactId') || '').trim() || null;
    let dealId = String(form.get('dealId') || '').trim() || null;
    let dealContactId = String(form.get('dealContactId') || '').trim() || null;
    const assignedToContactId = String(form.get('assignedToContactId') || '').trim() || null;
    const waitingOnContactId = String(form.get('waitingOnContactId') || '').trim() || null;

    const projectOk = await prisma.project.findFirst({ where: { id: params.id, userId }, select: { id: true } });
    if (!projectOk) return fail(404, { error: 'Project not found.' });

    if (dealContactId) {
      const link = await prisma.dealContact.findFirst({ where: { id: dealContactId, userId }, select: { id: true, dealId: true, contactId: true } });
      if (!link) return fail(404, { error: 'Deal-person thread not found.' });
      dealId = link.dealId;
      contactId = contactId || link.contactId;
    }

    const [contactOk, dealOk, assignedOk, waitingOk] = await Promise.all([
      ownedIdExists(userId, 'contact', contactId),
      ownedIdExists(userId, 'deal', dealId),
      ownedIdExists(userId, 'contact', assignedToContactId),
      ownedIdExists(userId, 'contact', waitingOnContactId)
    ]);
    if (!contactOk || !dealOk || !assignedOk || !waitingOk) return fail(404, { error: 'One of the selected links was not found.' });

    const notes = String(form.get('notes') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const assignedToText = String(form.get('assignedToText') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));

    await prisma.task.create({
      data: {
        userId,
        projectId: params.id,
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
        dealContactId
      }
    });

    throw redirect(303, `/projects/${params.id}`);
  },

  updateTaskStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });

    await prisma.task.updateMany({
      where: { id: taskId, userId: locals.user.id, projectId: params.id },
      data: { status, completedAt: status === 'DONE' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null }
    });

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

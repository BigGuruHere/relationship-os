// src/routes/tasks/+page.server.ts
// PURPOSE: Unified task inbox for relationship, deal, company, deal-thread, and project work.
// SECURITY: All reads and writes are tenant scoped by locals.user.id. Task text is encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { companyDisplay } from '$lib/companies';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import { safeDecrypt } from '$lib/deals';
import { marketLeadStatusLabel } from '$lib/marketLeads';
import {
  PROJECT_STATUSES,
  TASK_IMPORTANCES,
  TASK_FOCUS_OPTIONS,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  normaliseProjectStatus,
  normaliseTaskImportance,
  normaliseTaskFocus,
  normaliseTaskStatus,
  normaliseTaskType,
  normaliseTaskUrgency,
  parseDateTime,
  projectStatusLabel,
  safeDecryptTask,
  taskImportanceLabel,
  taskFocusLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

const ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];

const TASK_SORT_OPTIONS = [
  { value: 'focus', label: 'Focus order' },
  { value: 'due_asc', label: 'Due date - soonest' },
  { value: 'due_desc', label: 'Due date - latest' },
  { value: 'urgency', label: 'Urgency' },
  { value: 'importance', label: 'Importance' },
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'created_desc', label: 'Recently created' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'project', label: 'Project A-Z' },
  { value: 'lead', label: 'Lead A-Z' }
] as const;

type TaskSortValue = (typeof TASK_SORT_OPTIONS)[number]['value'];

const TASK_FOCUS_ORDER: Record<string, number> = { NEW: 0, DOING_NOW: 1, NOT_DOING_NOW: 2, NEVER_DOING_NOW: 3 };
const TASK_URGENCY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
const TASK_IMPORTANCE_ORDER: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };

type TaskFilters = {
  status: string;
  focus: string;
  projectId: string;
  marketLeadId: string;
  contactId: string;
  companyId: string;
  dealId: string;
};

type TaskRow = any;

function normaliseSort(value: string): TaskSortValue {
  return (TASK_SORT_OPTIONS.some((opt) => opt.value === value) ? value : 'focus') as TaskSortValue;
}

function taskOrderBy(sort: TaskSortValue): any {
  switch (sort) {
    case 'due_desc':
      return [{ dueAt: 'desc' as const }, { updatedAt: 'desc' as const }];
    case 'due_asc':
      return [{ dueAt: 'asc' as const }, { updatedAt: 'desc' as const }];
    case 'urgency':
      return [{ urgency: 'desc' as const }, { dueAt: 'asc' as const }, { updatedAt: 'desc' as const }];
    case 'importance':
      return [{ importance: 'desc' as const }, { dueAt: 'asc' as const }, { updatedAt: 'desc' as const }];
    case 'updated_desc':
      return [{ updatedAt: 'desc' as const }];
    case 'created_desc':
      return [{ createdAt: 'desc' as const }];
    default:
      return [{ focus: 'asc' as const }, { dueAt: 'asc' as const }, { urgency: 'desc' as const }, { updatedAt: 'desc' as const }];
  }
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
}

function sortMappedTasks(tasks: Awaited<ReturnType<typeof mapTask>>[], sort: TaskSortValue) {
  const dueTime = (task: Awaited<ReturnType<typeof mapTask>>) => task.dueAt ? new Date(task.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const updatedTime = (task: Awaited<ReturnType<typeof mapTask>>) => task.updatedAt ? new Date(task.updatedAt).getTime() : 0;

  return [...tasks].sort((a, b) => {
    if (sort === 'title') return compareText(a.title, b.title) || updatedTime(b) - updatedTime(a);
    if (sort === 'project') return compareText(a.project?.title, b.project?.title) || compareText(a.title, b.title);
    if (sort === 'lead') return compareText(a.marketLead?.title, b.marketLead?.title) || compareText(a.title, b.title);
    if (sort === 'due_desc') {
      const av = dueTime(a) === Number.POSITIVE_INFINITY ? Number.NEGATIVE_INFINITY : dueTime(a);
      const bv = dueTime(b) === Number.POSITIVE_INFINITY ? Number.NEGATIVE_INFINITY : dueTime(b);
      return bv - av || updatedTime(b) - updatedTime(a);
    }
    if (sort === 'due_asc') return dueTime(a) - dueTime(b) || updatedTime(b) - updatedTime(a);
    if (sort === 'urgency') return (TASK_URGENCY_ORDER[a.urgency] ?? 99) - (TASK_URGENCY_ORDER[b.urgency] ?? 99) || dueTime(a) - dueTime(b);
    if (sort === 'importance') return (TASK_IMPORTANCE_ORDER[a.importance] ?? 99) - (TASK_IMPORTANCE_ORDER[b.importance] ?? 99) || dueTime(a) - dueTime(b);
    if (sort === 'updated_desc') return updatedTime(b) - updatedTime(a);
    if (sort === 'created_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    return (
      (TASK_FOCUS_ORDER[a.focus] ?? 99) - (TASK_FOCUS_ORDER[b.focus] ?? 99) ||
      dueTime(a) - dueTime(b) ||
      (TASK_URGENCY_ORDER[a.urgency] ?? 99) - (TASK_URGENCY_ORDER[b.urgency] ?? 99) ||
      updatedTime(b) - updatedTime(a)
    );
  });
}

async function loadTaskRows(userId: string, filters: TaskFilters, sort: TaskSortValue) {
  const where: any = { userId };

  if (filters.status && TASK_STATUSES.some((s) => s.value === filters.status)) {
    where.status = filters.status;
  } else if (filters.status !== 'ALL') {
    where.status = { in: ACTIVE_STATUSES };
  }

  if (filters.focus && TASK_FOCUS_OPTIONS.some((f) => f.value === filters.focus)) where.focus = filters.focus;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.marketLeadId) where.marketLeadId = filters.marketLeadId;
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.dealId) where.dealId = filters.dealId;

  const orderBy = taskOrderBy(sort);

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
      focus: true,
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
      marketLead: { select: { id: true, titleEnc: true, type: true, status: true, projectId: true } },
      company: { select: { id: true, nameEnc: true, kind: true, status: true } },
      dealCompany: {
        select: {
          id: true,
          label: true,
          relationshipType: true,
          deal: { select: { id: true, titleEnc: true } },
          company: { select: { id: true, nameEnc: true, kind: true } }
        }
      },
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
    orderBy,
    take: 500
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
  const marketLeadTitle = row.marketLead ? safeDecryptTask(row.marketLead.titleEnc, 'market_lead.title', 'Untitled lead') : '';
  const companyName = row.company ? companyDisplay(row.company) : '';
  const dealCompanyDealTitle = row.dealCompany?.deal ? safeDecrypt(row.dealCompany.deal.titleEnc, 'deal.title', 'Untitled deal') : '';
  const dealCompanyName = row.dealCompany?.company ? companyDisplay(row.dealCompany.company) : '';
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
    focus: row.focus,
    focusLabel: taskFocusLabel(row.focus),
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
    marketLead: row.marketLead ? { id: row.marketLead.id, title: marketLeadTitle, type: row.marketLead.type, status: row.marketLead.status, statusLabel: marketLeadStatusLabel(row.marketLead.status), projectId: row.marketLead.projectId } : null,
    company: row.company ? { id: row.company.id, name: companyName, status: row.company.status } : null,
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
    task.marketLead?.title,
    task.company?.name,
    task.dealCompany?.dealTitle,
    task.dealCompany?.companyName,
    task.waitingOnContact?.name,
    task.assignedToContact?.name,
    task.assignedToText,
    task.dealContact?.dealTitle,
    task.dealContact?.contactName
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q.toLowerCase());
}

async function loadOptions(userId: string) {
  const [contactsRaw, dealsRaw, projectsRaw, companiesRaw, marketLeadsRaw, dealContactsRaw, dealCompaniesRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, kind: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.marketLead.findMany({ where: { userId, status: { notIn: ['ARCHIVED', 'NOT_RELEVANT'] as any } }, select: { id: true, titleEnc: true, type: true, status: true, projectId: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
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
        relationshipType: true,
        deal: { select: { id: true, titleEnc: true } },
        company: { select: { id: true, nameEnc: true, kind: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 300
    })
  ]);

  const contacts = await contactOptionsForRows(contactsRaw as any);
  const deals = dealsRaw.map((d) => ({ id: d.id, title: safeDecrypt(d.titleEnc, 'deal.title', 'Untitled deal'), status: d.status }));
  const projects = projectsRaw.map((p) => ({ id: p.id, title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(p.status) }));
  const companies = companiesRaw.map((c) => ({ id: c.id, name: companyDisplay(c), kind: c.kind, status: c.status }));
  const marketLeads = marketLeadsRaw.map((lead: any) => ({ id: lead.id, title: safeDecryptTask(lead.titleEnc, 'market_lead.title', 'Untitled lead'), type: lead.type, status: lead.status, statusLabel: marketLeadStatusLabel(lead.status), projectId: lead.projectId }));
  const dealContacts = await Promise.all(dealContactsRaw.map(async (link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    contactId: link.contact.id,
    label: link.label || '',
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${await contactDisplayName(link.contact)}${link.label ? ` (${link.label})` : ''}`
  })));
  const dealCompanies = dealCompaniesRaw.map((link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    companyId: link.company.id,
    label: link.label || '',
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${companyDisplay(link.company)}${link.label ? ` (${link.label})` : ''}`
  }));

  return { contacts, deals, projects, companies, marketLeads, dealContacts, dealCompanies };
}

async function ownedIdExists(userId: string, kind: 'contact' | 'deal' | 'project' | 'company' | 'marketLead', id: string | null) {
  if (!id) return true;
  if (kind === 'contact') return !!(await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'deal') return !!(await prisma.deal.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'company') return !!(await prisma.company.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'marketLead') return !!(await prisma.marketLead.findFirst({ where: { id, userId }, select: { id: true } }));
  return !!(await prisma.project.findFirst({ where: { id, userId }, select: { id: true } }));
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const userId = locals.user.id;
  const filters: TaskFilters = {
    status: String(url.searchParams.get('status') || '').trim().toUpperCase(),
    focus: String(url.searchParams.get('focus') || '').trim().toUpperCase(),
    projectId: String(url.searchParams.get('projectId') || '').trim(),
    marketLeadId: String(url.searchParams.get('marketLeadId') || '').trim(),
    contactId: String(url.searchParams.get('contactId') || '').trim(),
    companyId: String(url.searchParams.get('companyId') || '').trim(),
    dealId: String(url.searchParams.get('dealId') || '').trim()
  };
  const q = String(url.searchParams.get('q') || '').trim();
  const sort = normaliseSort(String(url.searchParams.get('sort') || '').trim());

  const rows = await loadTaskRows(userId, filters, sort);
  const mapped = await Promise.all(rows.map(mapTask));
  const tasks = sortMappedTasks(mapped.filter((task) => taskMatchesQuery(task, q)), sort);

  const now = new Date();
  const startTomorrow = new Date(now);
  startTomorrow.setHours(24, 0, 0, 0);

  const summary = {
    open: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any } } }),
    newTasks: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any }, focus: 'NEW' as any } }),
    doingNow: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any }, focus: 'DOING_NOW' as any } }),
    waiting: await prisma.task.count({ where: { userId, status: 'WAITING' as any } }),
    overdue: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any }, dueAt: { lt: now } } }),
    today: await prisma.task.count({ where: { userId, status: { in: ACTIVE_STATUSES as any }, dueAt: { gte: now, lt: startTomorrow } } })
  };

  return {
    q,
    selectedStatus: filters.status || '',
    selectedFocus: filters.focus || '',
    selectedProjectId: filters.projectId,
    selectedMarketLeadId: filters.marketLeadId,
    selectedContactId: filters.contactId,
    selectedCompanyId: filters.companyId,
    selectedDealId: filters.dealId,
    selectedSort: sort,
    currentPath: `${url.pathname}${url.search}`,
    tasks,
    summary,
    options: await loadOptions(userId),
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    taskTypes: TASK_TYPES,
    taskSortOptions: TASK_SORT_OPTIONS,
    projectStatuses: PROJECT_STATUSES
  };
};

function safeTaskReturnTo(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim();
  return raw.startsWith('/tasks') ? raw : '/tasks';
}

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
    let companyId = String(form.get('companyId') || '').trim() || null;
    let dealCompanyId = String(form.get('dealCompanyId') || '').trim() || null;
    let marketLeadId = String(form.get('marketLeadId') || '').trim() || null;
    let projectId = String(form.get('projectId') || '').trim() || null;
    const assignedToContactId = String(form.get('assignedToContactId') || '').trim() || null;
    const waitingOnContactId = String(form.get('waitingOnContactId') || '').trim() || null;

    if (dealContactId) {
      const link = await prisma.dealContact.findFirst({ where: { id: dealContactId, userId }, select: { id: true, dealId: true, contactId: true } });
      if (!link) return fail(404, { error: 'Deal relationship not found.' });
      dealId = link.dealId;
      contactId = link.contactId;
    }

    if (dealCompanyId) {
      const link = await prisma.dealCompany.findFirst({ where: { id: dealCompanyId, userId }, select: { id: true, dealId: true, companyId: true } });
      if (!link) return fail(404, { error: 'Deal-company link not found.' });
      dealId = link.dealId;
      companyId = link.companyId;
    }

    if (marketLeadId) {
      const lead = await prisma.marketLead.findFirst({ where: { id: marketLeadId, userId }, select: { id: true, projectId: true, contactId: true, companyId: true, dealId: true } });
      if (!lead) return fail(404, { error: 'Lead not found.' });
      projectId = projectId || lead.projectId || null;
      contactId = contactId || lead.contactId || null;
      companyId = companyId || lead.companyId || null;
      dealId = dealId || lead.dealId || null;
    }

    const [contactOk, dealOk, projectOk, companyOk, leadOk, assignedOk, waitingOk] = await Promise.all([
      ownedIdExists(userId, 'contact', contactId),
      ownedIdExists(userId, 'deal', dealId),
      ownedIdExists(userId, 'project', projectId),
      ownedIdExists(userId, 'company', companyId),
      ownedIdExists(userId, 'marketLead', marketLeadId),
      ownedIdExists(userId, 'contact', assignedToContactId),
      ownedIdExists(userId, 'contact', waitingOnContactId)
    ]);
    if (!contactOk || !dealOk || !projectOk || !companyOk || !leadOk || !assignedOk || !waitingOk) return fail(404, { error: 'One of the selected links was not found.' });

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
          focus: normaliseTaskFocus(form.get('focus')) as any,
          taskType: normaliseTaskType(form.get('taskType')) as any,
          dueAt: parseDateTime(form.get('dueAt')),
          snoozedUntil: parseDateTime(form.get('snoozedUntil')),
          assignedToTextEnc: assignedToText ? encrypt(assignedToText, 'task.assigned_to_text') : null,
          assignedToContactId,
          waitingOnContactId,
          contactId,
          dealId,
          dealContactId,
          companyId,
          dealCompanyId,
          marketLeadId,
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
    const returnTo = safeTaskReturnTo(form.get('returnTo'));
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

    throw redirect(303, returnTo);
  },

  updateFocus: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const returnTo = safeTaskReturnTo(form.get('returnTo'));
    const taskId = String(form.get('taskId') || '').trim();
    const focus = normaliseTaskFocus(form.get('focus'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });

    try {
      const res = await prisma.task.updateMany({ where: { id: taskId, userId: locals.user.id }, data: { focus: focus as any } });
      if (!res.count) return fail(404, { error: 'Task not found.' });
    } catch (err) {
      console.error('[tasks:updateFocus] failed', err);
      return fail(500, { error: 'Could not update task focus.' });
    }

    throw redirect(303, returnTo);
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const returnTo = safeTaskReturnTo(form.get('returnTo'));
    const taskId = String(form.get('taskId') || '').trim();
    if (!taskId) return fail(400, { error: 'Missing task id.' });

    await prisma.task.deleteMany({ where: { id: taskId, userId: locals.user.id } });
    throw redirect(303, returnTo);
  },

  createProject: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const title = String(form.get('projectTitle') || '').trim();
    if (!title) return fail(400, { error: 'Project title is required.' });
    const description = String(form.get('projectDescription') || '').trim();
    const existing = await prisma.project.findFirst({ where: { userId: locals.user.id, titleIdx: buildIndexToken(title) }, select: { id: true } });
    if (existing) return fail(409, { error: 'A project with this title already exists.' });

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

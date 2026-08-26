// src/routes/workstreams/+page.server.ts
// PURPOSE: First-class operational index for Project Workstreams, designed as the daily entry point into active lanes of work.
// SECURITY: Every query and status update is scoped to the authenticated Relish user. Workstream text remains encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { safeDecryptTask, taskStatusLabel } from '$lib/tasks';

const ACTIVE_TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];
const ACTIVE_WANT_STATUSES = ['NEW', 'CLARIFYING_CRITERIA', 'ACTIVE_MANDATE', 'WATCHING_MARKET', 'MATCHED'];
const ACTIVE_OFFER_STATUSES = ['NEW', 'CLARIFYING_SUPPLY', 'AVAILABLE', 'WATCHING_INTEREST', 'MATCHED'];
const ACTIVE_LEAD_STATUSES = ['NEW', 'NOT_CONTACTED', 'RESEARCHING', 'TRIED_NO_CONTACT', 'LEFT_VOICEMAIL', 'FOLLOW_UP_NEEDED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'NURTURE'];

const WORKSTREAM_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' }
] as const;

function workstreamStatusLabel(value: string | null | undefined) {
  if (value === 'PAUSED') return 'Paused';
  if (value === 'COMPLETED') return 'Completed';
  if (value === 'ARCHIVED') return 'Archived';
  return 'Active';
}

function countMap(rows: any[]) {
  return new Map(rows.map((row: any) => [row.workstreamId, Number(row._count?._all ?? row._count?.workstreamId ?? 0)]));
}

function activityMap(rows: any[]) {
  return new Map(rows.map((row: any) => [row.workstreamId, row._max?.updatedAt || null]));
}

function latestDate(...values: Array<Date | string | null | undefined>) {
  const times = values.map((value) => (value ? new Date(value).getTime() : 0)).filter((value) => Number.isFinite(value));
  return times.length ? new Date(Math.max(...times)) : null;
}

function taskSortValue(task: any) {
  // IT: Dated tasks come first, then undated tasks use most recent activity as a practical tie-breaker.
  const due = task.dueAt ? new Date(task.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const updated = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
  return [due, -updated];
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const rawStatus = String(url.searchParams.get('status') || 'ACTIVE').trim().toUpperCase();
  const status = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ALL'].includes(rawStatus) ? rawStatus : 'ACTIVE';
  const projectId = String(url.searchParams.get('projectId') || '').trim();
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  const sort = String(url.searchParams.get('sort') || 'attention').trim().toLowerCase();

  const where: any = { userId };
  if (status === 'ALL') where.status = { not: 'ARCHIVED' as any };
  else where.status = status as any;
  if (projectId) where.projectId = projectId;

  const [rows, projectsRaw] = await Promise.all([
    prisma.projectWorkstream.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        nameEnc: true,
        descriptionEnc: true,
        status: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, titleEnc: true, status: true } }
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 1000
    }),
    prisma.project.findMany({
      where: { userId, status: { not: 'ARCHIVED' as any } },
      select: { id: true, titleEnc: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 300
    })
  ]);

  const ids = rows.map((row: any) => row.id);
  const now = new Date();

  const emptyGroup = Promise.resolve([] as any[]);
  const [taskCountsRaw, overdueCountsRaw, wantCountsRaw, offerCountsRaw, leadCountsRaw, dealCountsRaw, noteCountsRaw, openTasksRaw, taskActivityRaw, wantActivityRaw, offerActivityRaw, leadActivityRaw, dealActivityRaw, noteActivityRaw] = ids.length
    ? await Promise.all([
        prisma.task.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids }, status: { in: ACTIVE_TASK_STATUSES as any } }, _count: { _all: true } }),
        prisma.task.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids }, status: { in: ACTIVE_TASK_STATUSES as any }, dueAt: { lt: now } }, _count: { _all: true } }),
        prisma.want.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids }, status: { in: ACTIVE_WANT_STATUSES as any } }, _count: { _all: true } }),
        prisma.offer.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids }, status: { in: ACTIVE_OFFER_STATUSES as any } }, _count: { _all: true } }),
        prisma.marketLead.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids }, status: { in: ACTIVE_LEAD_STATUSES as any } }, _count: { _all: true } }),
        prisma.projectDeal.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _count: { _all: true } }),
        prisma.projectNote.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _count: { _all: true } }),
        prisma.task.findMany({
          where: { userId, workstreamId: { in: ids }, status: { in: ACTIVE_TASK_STATUSES as any } },
          select: { id: true, workstreamId: true, titleEnc: true, status: true, dueAt: true, urgency: true, focus: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 2500
        }),
        prisma.task.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _max: { updatedAt: true } }),
        prisma.want.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _max: { updatedAt: true } }),
        prisma.offer.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _max: { updatedAt: true } }),
        prisma.marketLead.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _max: { updatedAt: true } }),
        prisma.projectDeal.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _max: { updatedAt: true } }),
        prisma.projectNote.groupBy({ by: ['workstreamId'], where: { userId, workstreamId: { in: ids } }, _max: { updatedAt: true } })
      ])
    : await Promise.all([emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup, emptyGroup]);

  const taskCounts = countMap(taskCountsRaw);
  const overdueCounts = countMap(overdueCountsRaw);
  const wantCounts = countMap(wantCountsRaw);
  const offerCounts = countMap(offerCountsRaw);
  const leadCounts = countMap(leadCountsRaw);
  const dealCounts = countMap(dealCountsRaw);
  const noteCounts = countMap(noteCountsRaw);
  const taskActivity = activityMap(taskActivityRaw);
  const wantActivity = activityMap(wantActivityRaw);
  const offerActivity = activityMap(offerActivityRaw);
  const leadActivity = activityMap(leadActivityRaw);
  const dealActivity = activityMap(dealActivityRaw);
  const noteActivity = activityMap(noteActivityRaw);

  const tasksByWorkstream = new Map<string, any[]>();
  for (const task of openTasksRaw as any[]) {
    if (!task.workstreamId) continue;
    const list = tasksByWorkstream.get(task.workstreamId) || [];
    list.push(task);
    tasksByWorkstream.set(task.workstreamId, list);
  }

  let workstreams = rows.map((row: any) => {
    const tasks = (tasksByWorkstream.get(row.id) || []).sort((a: any, b: any) => {
      const [aDue, aUpdated] = taskSortValue(a);
      const [bDue, bUpdated] = taskSortValue(b);
      return aDue - bDue || aUpdated - bUpdated;
    });
    const next = tasks[0] || null;
    const lastActivityAt = latestDate(
      row.updatedAt,
      taskActivity.get(row.id),
      wantActivity.get(row.id),
      offerActivity.get(row.id),
      leadActivity.get(row.id),
      dealActivity.get(row.id),
      noteActivity.get(row.id)
    );

    return {
      id: row.id,
      projectId: row.projectId,
      name: safeDecryptTask(row.nameEnc, 'project_workstream.name', 'Untitled workstream'),
      description: safeDecryptTask(row.descriptionEnc, 'project_workstream.description', ''),
      status: row.status,
      statusLabel: workstreamStatusLabel(row.status),
      project: {
        id: row.project.id,
        title: safeDecryptTask(row.project.titleEnc, 'project.title', 'Untitled project'),
        status: row.project.status
      },
      openTasks: taskCounts.get(row.id) || 0,
      overdueTasks: overdueCounts.get(row.id) || 0,
      wants: wantCounts.get(row.id) || 0,
      offers: offerCounts.get(row.id) || 0,
      leads: leadCounts.get(row.id) || 0,
      deals: dealCounts.get(row.id) || 0,
      notes: noteCounts.get(row.id) || 0,
      nextTask: next
        ? {
            id: next.id,
            title: safeDecryptTask(next.titleEnc, 'task.title', 'Untitled task'),
            status: next.status,
            statusLabel: taskStatusLabel(next.status),
            dueAt: next.dueAt,
            urgency: next.urgency,
            focus: next.focus
          }
        : null,
      lastActivityAt,
      updatedAt: row.updatedAt
    };
  });

  if (q) {
    workstreams = workstreams.filter((item: any) => [item.name, item.description, item.project.title, item.statusLabel, item.nextTask?.title].filter(Boolean).join(' ').toLowerCase().includes(q));
  }

  if (sort === 'activity') {
    workstreams.sort((a: any, b: any) => new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime());
  } else if (sort === 'project') {
    workstreams.sort((a: any, b: any) => a.project.title.localeCompare(b.project.title) || a.name.localeCompare(b.name));
  } else if (sort === 'name') {
    workstreams.sort((a: any, b: any) => a.name.localeCompare(b.name));
  } else {
    // IT: Daily default puts overdue work first, then workstreams with more open action, then recent activity.
    workstreams.sort((a: any, b: any) => b.overdueTasks - a.overdueTasks || b.openTasks - a.openTasks || new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime());
  }

  const projects = projectsRaw.map((project: any) => ({
    id: project.id,
    title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'),
    status: project.status
  }));

  return {
    workstreams,
    projects,
    filters: { status, projectId, q: String(url.searchParams.get('q') || ''), sort },
    statusOptions: WORKSTREAM_STATUS_OPTIONS,
    summary: {
      workstreams: workstreams.length,
      openTasks: workstreams.reduce((sum: number, item: any) => sum + item.openTasks, 0),
      overdueTasks: workstreams.reduce((sum: number, item: any) => sum + item.overdueTasks, 0),
      wants: workstreams.reduce((sum: number, item: any) => sum + item.wants, 0),
      offers: workstreams.reduce((sum: number, item: any) => sum + item.offers, 0),
      leads: workstreams.reduce((sum: number, item: any) => sum + item.leads, 0),
      deals: workstreams.reduce((sum: number, item: any) => sum + item.deals, 0)
    }
  };
};

export const actions: Actions = {
  updateStatus: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const workstreamId = String(form.get('workstreamId') || '').trim();
    const status = String(form.get('status') || '').trim().toUpperCase();
    if (!workstreamId) return fail(400, { error: 'Missing workstream id.' });
    if (!WORKSTREAM_STATUS_OPTIONS.some((option) => option.value === status)) return fail(400, { error: 'Invalid workstream status.' });

    await prisma.projectWorkstream.updateMany({
      where: { id: workstreamId, userId: locals.user.id },
      data: { status: status as any }
    });

    return { success: true };
  }
};

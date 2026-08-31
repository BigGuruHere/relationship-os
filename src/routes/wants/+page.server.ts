// src/routes/wants/+page.server.ts
// PURPOSE: First-class Want list and create workflow.
// SECURITY: All reads/writes are scoped to locals.user.id. Want text is encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { safeDecrypt } from '$lib/deals';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { createWantFromForm, mapWant, wantSelect } from '$lib/server/wants';
import { WANT_CONFIDENCES, WANT_STATUSES, WANT_TIME_HORIZONS, WANT_TYPES, WANT_URGENCIES } from '$lib/wants';
import { KNOWLEDGE_AUTHORITIES, KNOWLEDGE_SOURCE_TYPES } from '$lib/provenance';


const SORT_OPTIONS = [
  { value: 'attention', label: 'Attention' },
  { value: 'urgency', label: 'Urgency' },
  { value: 'importance', label: 'Importance' },
  { value: 'review', label: 'Review date' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'title', label: 'Title A-Z' }
] as const;

const URGENCY_SCORE: Record<string, number> = { IMMEDIATE: 40, CRITICAL: 40, HIGH: 25, NORMAL: 10, LOW: 0 };

function sortItems(items: any[], sort: string, openTasks: any[]) {
  const now = Date.now();
  const taskMap = new Map<string, { overdue: number; today: number }>();
  const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
  for (const task of openTasks) {
    if (!task.wantId) continue;
    const state = taskMap.get(task.wantId) || { overdue: 0, today: 0 };
    if (task.dueAt) {
      const due = new Date(task.dueAt).getTime();
      if (due < now) state.overdue += 1;
      else if (due < tomorrow.getTime()) state.today += 1;
    }
    taskMap.set(task.wantId, state);
  }
  const attention = (item: any) => {
    const tasks = taskMap.get(item.id) || { overdue: 0, today: 0 };
    let score = tasks.overdue * 100 + tasks.today * 60 + (URGENCY_SCORE[item.urgency] || 0) + Number(item.importance || 0) * 8;
    if (item.reviewAt) {
      const days = (new Date(item.reviewAt).getTime() - now) / 86_400_000;
      if (days <= 0) score += 35;
      else if (days <= 7) score += 20;
      else if (days <= 30) score += 8;
    }
    return score;
  };
  const updated = (item: any) => new Date(item.updatedAt || 0).getTime();
  const review = (item: any) => item.reviewAt ? new Date(item.reviewAt).getTime() : Number.POSITIVE_INFINITY;
  return [...items].sort((a, b) => {
    if (sort === 'urgency') return (URGENCY_SCORE[b.urgency] || 0) - (URGENCY_SCORE[a.urgency] || 0) || Number(b.importance || 0) - Number(a.importance || 0) || updated(b) - updated(a);
    if (sort === 'importance') return Number(b.importance || 0) - Number(a.importance || 0) || (URGENCY_SCORE[b.urgency] || 0) - (URGENCY_SCORE[a.urgency] || 0) || updated(b) - updated(a);
    if (sort === 'review') return review(a) - review(b) || updated(b) - updated(a);
    if (sort === 'updated') return updated(b) - updated(a);
    if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' });
    return attention(b) - attention(a) || updated(b) - updated(a);
  });
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  const selectedStatus = String(url.searchParams.get('status') || '').trim().toUpperCase();
  const selectedType = String(url.searchParams.get('wantType') || '').trim().toUpperCase();
  const selectedProjectId = String(url.searchParams.get('projectId') || '').trim();
  const selectedWorkstreamId = String(url.searchParams.get('workstreamId') || '').trim();
  const selectedSort = SORT_OPTIONS.some((opt) => opt.value === url.searchParams.get('sort')) ? String(url.searchParams.get('sort')) : 'attention';

  const where: any = { userId };
  if (selectedStatus && WANT_STATUSES.some((o) => o.value === selectedStatus)) where.status = selectedStatus;
  else where.status = { not: 'ARCHIVED' as any };
  if (selectedType && WANT_TYPES.some((o) => o.value === selectedType)) where.wantType = selectedType;
  if (selectedProjectId) where.projectId = selectedProjectId;
  if (selectedWorkstreamId) where.workstreamId = selectedWorkstreamId;

  const [rows, projectsRaw, workstreamsRaw, contactsRaw, companiesRaw, dealsRaw, counts, openTasks] = await Promise.all([
    prisma.want.findMany({ where, select: wantSelect, orderBy: [{ status: 'asc' }, { importance: 'desc' }, { updatedAt: 'desc' }], take: 300 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.projectWorkstream.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, projectId: true, project: { select: { titleEnc: true } } }, orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }], take: 300 }),
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.want.groupBy({ by: ['status'], where: { userId }, _count: { status: true } }),
    prisma.task.findMany({ where: { userId, wantId: { not: null }, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } }, select: { wantId: true, dueAt: true }, take: 5000 })
  ]);

  let wants = rows.map(mapWant);
  if (q) {
    wants = wants.filter((want) => [want.title, want.description, want.criteria, want.category, want.geography, want.wantTypeLabel, want.statusLabel, want.contact?.name, want.company?.name, want.project?.title, want.workstream?.name].join(' ').toLowerCase().includes(q));
  }
  wants = sortItems(wants, selectedSort, openTasks);

  const openCount = counts.filter((row: any) => !['ARCHIVED', 'WITHDRAWN', 'FULFILLED', 'EXPIRED'].includes(String(row.status))).reduce((sum: number, row: any) => sum + row._count.status, 0);
  const summary = {
    openCount,
    active: counts.find((row: any) => row.status === 'ACTIVE')?._count.status || 0,
    paused: counts.find((row: any) => row.status === 'PAUSED')?._count.status || 0,
    fulfilled: counts.find((row: any) => row.status === 'FULFILLED')?._count.status || 0
  };

  return {
    wants,
    q,
    selectedStatus,
    selectedType,
    selectedProjectId,
    selectedWorkstreamId,
    selectedSort,
    sortOptions: SORT_OPTIONS,
    summary,
    wantTypes: WANT_TYPES,
    wantStatuses: WANT_STATUSES,
    wantUrgencies: WANT_URGENCIES,
    wantTimeHorizons: WANT_TIME_HORIZONS,
    wantConfidences: WANT_CONFIDENCES,
    knowledgeAuthorities: KNOWLEDGE_AUTHORITIES,
    knowledgeSourceTypes: KNOWLEDGE_SOURCE_TYPES,
    projects: projectsRaw.map((p: any) => ({ id: p.id, title: safeDecrypt(p.titleEnc, 'project.title', 'Untitled project') })),
    workstreams: workstreamsRaw.map((ws: any) => ({ id: ws.id, projectId: ws.projectId, name: safeDecrypt(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectTitle: safeDecrypt(ws.project?.titleEnc, 'project.title', 'Untitled project') })),
    contacts: await Promise.all(contactsRaw.map(async (c: any) => ({ id: c.id, name: await contactDisplayName(c) }))),
    companies: companiesRaw.map((c: any) => ({ id: c.id, name: safeDecrypt(c.nameEnc, 'company.name', 'Untitled company') })),
    deals: dealsRaw.map((d: any) => ({ id: d.id, title: safeDecrypt(d.titleEnc, 'deal.title', 'Untitled deal'), status: d.status }))
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      const want = await createWantFromForm({ userId: locals.user.id, form: await request.formData() });
      throw redirect(303, `/wants/${want.id}`);
    } catch (err: any) {
      if (err?.status) throw err;
      return fail(400, { error: err?.message || 'Could not create want.' });
    }
  }
};

// src/routes/wants/[id]/+page.server.ts
// PURPOSE: First-class Want workspace with criteria, notes, tasks, and conversion to deal.
// SECURITY: Every operation is scoped to locals.user.id.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { safeDecrypt, centsToMillionsInputValue } from '$lib/deals';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { createTaskFromForm } from '$lib/server/tasks';
import { NOTE_CHANNELS, dateToDatetimeLocal, noteChannelLabel } from '$lib/marketLeads';
import {
  createWantNote,
  deleteWantNote,
  loadWant,
  loadWantNotes,
  updateWantFromForm,
  updateWantNote
} from '$lib/server/wants';
import { WANT_CONFIDENCES, WANT_STATUSES, WANT_TIME_HORIZONS, WANT_TYPES, WANT_URGENCIES, dateToInputDate } from '$lib/wants';
import { TASK_FOCUS_OPTIONS, TASK_STATUSES, TASK_TYPES, taskFocusLabel, taskStatusLabel, taskTypeLabel, safeDecryptTask } from '$lib/tasks';
import { KNOWLEDGE_AUTHORITIES, KNOWLEDGE_SOURCE_TYPES } from '$lib/provenance';


export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const want = await loadWant(userId, params.id);
  if (!want) throw redirect(303, '/wants');

  const [notes, tasksRaw, contactsRaw, companiesRaw, dealsRaw, projectsRaw, workstreamsRaw] = await Promise.all([
    loadWantNotes(userId, want.id),
    prisma.task.findMany({
      where: { userId, wantId: want.id },
      select: { id: true, titleEnc: true, notesEnc: true, status: true, focus: true, taskType: true, dueAt: true, project: { select: { id: true, titleEnc: true } }, workstream: { select: { id: true, nameEnc: true, projectId: true } }, contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }, company: { select: { id: true, nameEnc: true } }, deal: { select: { id: true, titleEnc: true } }, createdAt: true, updatedAt: true },
      orderBy: [{ status: 'asc' }, { focus: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 100
    }),
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.company.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    prisma.projectWorkstream.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, nameEnc: true, projectId: true, project: { select: { titleEnc: true } } }, orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }], take: 300 })
  ]);

  const tasks = await Promise.all(tasksRaw.map(async (task: any) => ({
    id: task.id,
    title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
    notes: safeDecryptTask(task.notesEnc, 'task.notes', ''),
    status: task.status,
    statusLabel: taskStatusLabel(task.status),
    focus: task.focus,
    focusLabel: taskFocusLabel(task.focus),
    taskType: task.taskType,
    taskTypeLabel: taskTypeLabel(task.taskType),
    dueAt: task.dueAt,
    project: task.project ? { id: task.project.id, title: safeDecrypt(task.project.titleEnc, 'project.title', 'Untitled project') } : null,
    workstream: task.workstream ? { id: task.workstream.id, name: safeDecrypt(task.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectId: task.workstream.projectId } : null,
    contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
    company: task.company ? { id: task.company.id, name: safeDecrypt(task.company.nameEnc, 'company.name', 'Untitled company') } : null,
    deal: task.deal ? { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal') } : null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  })));

  return {
    want,
    editValues: {
      reviewAt: dateToInputDate(want.reviewAt),
      expiresAt: dateToInputDate(want.expiresAt),
      confirmedAt: dateToInputDate(want.confirmedAt),
      valueMin: centsToMillionsInputValue(want.valueMinCents),
      valueMax: centsToMillionsInputValue(want.valueMaxCents)
    },
    notes: notes.map((note) => ({ ...note, occurredInput: dateToDatetimeLocal(note.occurredAt), channelLabel: noteChannelLabel(note.channel) })),
    tasks,
    noteChannels: NOTE_CHANNELS,
    taskStatuses: TASK_STATUSES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    taskTypes: TASK_TYPES,
    wantTypes: WANT_TYPES,
    wantStatuses: WANT_STATUSES,
    wantUrgencies: WANT_URGENCIES,
    wantTimeHorizons: WANT_TIME_HORIZONS,
    wantConfidences: WANT_CONFIDENCES,
    knowledgeAuthorities: KNOWLEDGE_AUTHORITIES,
    knowledgeSourceTypes: KNOWLEDGE_SOURCE_TYPES,
    contacts: await Promise.all(contactsRaw.map(async (c: any) => ({ id: c.id, name: await contactDisplayName(c) }))),
    companies: companiesRaw.map((c: any) => ({ id: c.id, name: safeDecrypt(c.nameEnc, 'company.name', 'Untitled company') })),
    deals: dealsRaw.map((d: any) => ({ id: d.id, title: safeDecrypt(d.titleEnc, 'deal.title', 'Untitled deal'), status: d.status })),
    projects: projectsRaw.map((p: any) => ({ id: p.id, title: safeDecrypt(p.titleEnc, 'project.title', 'Untitled project') })),
    workstreams: workstreamsRaw.map((ws: any) => ({ id: ws.id, projectId: ws.projectId, name: safeDecrypt(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectTitle: safeDecrypt(ws.project?.titleEnc, 'project.title', 'Untitled project') }))
  };
};

export const actions: Actions = {
  updateWant: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      await updateWantFromForm({ userId: locals.user.id, wantId: params.id, form: await request.formData() });
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Could not update want.' });
    }
    throw redirect(303, `/wants/${params.id}`);
  },

  addNote: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      await createWantNote(locals.user.id, params.id, await request.formData());
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Could not add note.' });
    }
    throw redirect(303, `/wants/${params.id}`);
  },

  updateNote: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const noteId = String(form.get('noteId') || '').trim();
    if (!noteId) return fail(400, { error: 'Missing note id.' });
    try {
      await updateWantNote(locals.user.id, noteId, form);
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Could not update note.' });
    }
    throw redirect(303, `/wants/${params.id}`);
  },

  deleteNote: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const noteId = String(form.get('noteId') || '').trim();
    if (!noteId) return fail(400, { error: 'Missing note id.' });
    await deleteWantNote(locals.user.id, noteId);
    throw redirect(303, `/wants/${params.id}`);
  },

  createTask: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const result = await createTaskFromForm(locals.user.id, await request.formData(), { wantId: params.id });
    if (!result.ok) return fail(result.status, { error: result.error });
    throw redirect(303, `/wants/${params.id}`);
  },

  convertToDeal: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const wantRow = await loadWant(userId, params.id);
    if (!wantRow) return fail(404, { error: 'Want not found.' });
    const title = wantRow.title || 'Untitled want';
    const description = [wantRow.description, wantRow.criteria].filter(Boolean).join('\n\n');
    const deal = await prisma.deal.create({
      data: {
        userId,
        titleEnc: encrypt(`Deal from want: ${title}`, 'deal.title'),
        titleIdx: buildIndexToken(`Deal from want: ${title}`),
        descriptionEnc: description ? encrypt(description, 'deal.description') : null,
        valueCents: wantRow.valueMaxCents || wantRow.valueMinCents || null,
        currency: wantRow.currency || 'AUD',
        status: 'DISCOVERY' as any
      },
      select: { id: true }
    });
    if (wantRow.contactId) await prisma.dealContact.create({ data: { userId, dealId: deal.id, contactId: wantRow.contactId, label: 'want contact', relationshipType: 'BUYER' as any } }).catch(() => null);
    if (wantRow.companyId) await prisma.dealCompany.create({ data: { userId, dealId: deal.id, companyId: wantRow.companyId, label: 'want company', relationshipType: 'BUYER' as any } }).catch(() => null);
    if (wantRow.projectId) await prisma.projectDeal.upsert({ where: { projectId_dealId: { projectId: wantRow.projectId, dealId: deal.id } }, update: wantRow.workstreamId ? { workstreamId: wantRow.workstreamId } : {}, create: { userId, projectId: wantRow.projectId, dealId: deal.id, workstreamId: wantRow.workstreamId || null } }).catch(() => null);
    await prisma.want.updateMany({ where: { id: params.id, userId }, data: { dealId: deal.id, convertedDealId: deal.id, status: 'ACTIVE' as any } });
    await prisma.task.updateMany({ where: { userId, wantId: params.id, dealId: null }, data: { dealId: deal.id } }).catch(() => null);
    throw redirect(303, `/deals/${deal.id}`);
  }
};

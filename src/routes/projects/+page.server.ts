// src/routes/projects/+page.server.ts
// PURPOSE: Lightweight project list for grouping tasks across people and deals.
// SECURITY: All reads and writes are scoped by userId and project text is encrypted.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { PROJECT_STATUSES, normaliseProjectStatus, projectStatusLabel, safeDecryptTask, taskStatusLabel } from '$lib/tasks';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const rows = await prisma.project.findMany({
    where: { userId: locals.user.id },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      tasks: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
        select: { id: true, titleEnc: true, status: true, dueAt: true },
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: 8
      }
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 200
  });

  const projects = rows.map((p: any) => ({
    id: p.id,
    title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project'),
    description: safeDecryptTask(p.descriptionEnc, 'project.description', ''),
    status: p.status,
    statusLabel: projectStatusLabel(p.status),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    tasks: p.tasks.map((t: any) => ({
      id: t.id,
      title: safeDecryptTask(t.titleEnc, 'task.title', 'Untitled task'),
      status: t.status,
      statusLabel: taskStatusLabel(t.status),
      dueAt: t.dueAt
    }))
  }));

  return { projects, projectStatuses: PROJECT_STATUSES };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Project title is required.' });
    const description = String(form.get('description') || '').trim();
    const existing = await prisma.project.findFirst({ where: { userId: locals.user.id, titleIdx: buildIndexToken(title) }, select: { id: true } });
    if (existing) return fail(409, { error: 'A project with this title already exists.' });

    await prisma.project.create({
      data: {
        userId: locals.user.id,
        titleEnc: encrypt(title, 'project.title'),
        titleIdx: buildIndexToken(title),
        descriptionEnc: description ? encrypt(description, 'project.description') : null,
        status: normaliseProjectStatus(form.get('status')) as any
      }
    });

    throw redirect(303, '/projects');
  },

  updateStatus: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const id = String(form.get('projectId') || '').trim();
    if (!id) return fail(400, { error: 'Missing project id.' });

    await prisma.project.updateMany({
      where: { id, userId: locals.user.id },
      data: { status: normaliseProjectStatus(form.get('status')) as any }
    });

    throw redirect(303, '/projects');
  }
};

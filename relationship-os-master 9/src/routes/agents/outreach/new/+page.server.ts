// src/routes/agents/outreach/new/+page.server.ts
// PURPOSE: Start the Stage 2 Outreach Agent from a safe manual form.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { safeDecrypt } from '$lib/deals';
import { safeDecryptTask, projectStatusLabel } from '$lib/tasks';
import { runOutreachAgent } from '$lib/server/agents/agents/outreachAgent';
import { ensureCoreAgentSetup } from '$lib/server/agents/agentSetup';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  await ensureCoreAgentSetup(userId);

  const [projectsRaw, dealsRaw] = await Promise.all([
    prisma.project.findMany({ where: { userId, status: { not: 'ARCHIVED' as any } }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 100 })
  ]);

  return {
    projects: projectsRaw.map((p) => ({ id: p.id, title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(p.status) })),
    deals: dealsRaw.map((d) => ({ id: d.id, title: safeDecrypt(d.titleEnc, 'deal.title', 'Untitled deal'), status: d.status }))
  };
};

export const actions: Actions = {
  start: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();

    const sector = String(form.get('sector') || '').trim();
    const geography = String(form.get('geography') || '').trim();
    const targetDescription = String(form.get('targetDescription') || '').trim();
    const outreachGoal = String(form.get('outreachGoal') || '').trim();
    const sourceText = String(form.get('sourceText') || '').trim();
    const enableWebResearch = form.get('enableWebResearch') === 'on';
    const findContacts = form.get('findContacts') === 'on';
    const researchProvider = String(form.get('researchProvider') || '').trim() || undefined;
    const projectId = String(form.get('projectId') || '').trim() || undefined;
    const dealId = String(form.get('dealId') || '').trim() || undefined;
    const maxCandidatesRaw = Number.parseInt(String(form.get('maxCandidates') || '5'), 10);
    const maxCandidates = Number.isFinite(maxCandidatesRaw) ? Math.max(1, Math.min(25, maxCandidatesRaw)) : 5;

    if (!sector) return fail(400, { error: 'Sector is required.' });
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId: locals.user.id }, select: { id: true } });
      if (!project) return fail(404, { error: 'Selected project was not found.' });
    }
    if (dealId) {
      const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: locals.user.id }, select: { id: true } });
      if (!deal) return fail(404, { error: 'Selected deal was not found.' });
    }

    const run = await runOutreachAgent({
      userId: locals.user.id,
      sector,
      geography: geography || undefined,
      targetDescription: targetDescription || undefined,
      outreachGoal: outreachGoal || undefined,
      sourceText: sourceText || undefined,
      maxCandidates,
      enableWebResearch,
      findContacts,
      researchProvider,
      projectId,
      dealId
    });

    throw redirect(303, `/agents/runs/${run.id}`);
  }
};

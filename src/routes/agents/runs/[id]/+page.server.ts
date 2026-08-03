// src/routes/agents/runs/[id]/+page.server.ts
// PURPOSE: Detailed run console showing steps, tool calls, model calls, artifacts, approvals, linked entities, and Stage 2 outreach candidates.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { loadAgentArtifacts } from '$lib/server/agents/artifacts';
import { safeDecryptCompany } from '$lib/companies';

function dec(payload: string | null | undefined, aad: string, fallback = '') {
  return safeDecryptCompany(payload, aad, fallback);
}

async function loadCandidates(userId: string, agentRunId: string) {
  const rows = await prisma.researchCandidate.findMany({
    where: { userId, agentRunId },
    select: {
      id: true,
      entityType: true,
      status: true,
      nameEnc: true,
      websiteEnc: true,
      sourceUrlEnc: true,
      sourceLabelEnc: true,
      confidence: true,
      structuredJson: true,
      notesEnc: true,
      createdEntityType: true,
      createdEntityId: true,
      createdAt: true,
      updatedAt: true,
      opportunityScores: {
        select: {
          id: true,
          totalScore: true,
          sectorFitScore: true,
          ownerLedScore: true,
          dealLikelihoodScore: true,
          outreachFitScore: true,
          timingScore: true,
          confidenceScore: true,
          rationaleJson: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
  });

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    status: row.status,
    name: dec(row.nameEnc, 'research_candidate.name', 'Untitled candidate'),
    website: dec(row.websiteEnc, 'research_candidate.website', ''),
    sourceUrl: dec(row.sourceUrlEnc, 'research_candidate.source_url', ''),
    sourceLabel: dec(row.sourceLabelEnc, 'research_candidate.source_label', ''),
    confidence: row.confidence,
    notes: dec(row.notesEnc, 'research_candidate.notes', ''),
    structuredJson: row.structuredJson,
    createdEntityType: row.createdEntityType,
    createdEntityId: row.createdEntityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    score: row.opportunityScores[0] ?? null
  }));
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const run = await prisma.agentRun.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      status: true,
      triggerType: true,
      triggerEntityType: true,
      triggerEntityId: true,
      inputJson: true,
      resultJson: true,
      errorMessage: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      agentDefinition: { select: { id: true, key: true, name: true, description: true, category: true, defaultModelProvider: true, defaultModelName: true } },
      promptVersion: { select: { id: true, version: true, createdAt: true } },
      steps: {
        select: { id: true, stepKey: true, stepName: true, status: true, inputJson: true, outputJson: true, errorMessage: true, startedAt: true, completedAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      },
      toolCalls: {
        select: { id: true, toolKey: true, status: true, inputJson: true, outputJson: true, errorMessage: true, createdEntityType: true, createdEntityId: true, startedAt: true, completedAt: true, createdAt: true, agentStepId: true },
        orderBy: { createdAt: 'asc' }
      },
      modelInvocations: {
        select: { id: true, provider: true, model: true, purpose: true, status: true, inputTokens: true, outputTokens: true, requestJsonRedacted: true, responseJsonRedacted: true, structuredOutputJson: true, errorMessage: true, createdAt: true, agentStepId: true },
        orderBy: { createdAt: 'asc' }
      },
      approvals: {
        select: { id: true, actionType: true, status: true, entityType: true, entityId: true, proposedActionJson: true, reviewerNote: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' }
      },
      entities: {
        select: { id: true, entityType: true, entityId: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!run) throw redirect(303, '/agents/runs');

  const [artifacts, candidates] = await Promise.all([
    loadAgentArtifacts({ userId, agentRunId: run.id, take: 30 }),
    loadCandidates(userId, run.id)
  ]);

  return { run, artifacts, candidates };
};

function redirectBack(runId: string) {
  throw redirect(303, `/agents/runs/${runId}`);
}

async function getOwnedCandidate(userId: string, candidateId: string, runId: string) {
  return prisma.researchCandidate.findFirst({ where: { id: candidateId, userId, agentRunId: runId } });
}

export const actions: Actions = {
  approveCandidate: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    if (!candidateId) return fail(400, { error: 'Missing candidate id.' });

    await prisma.researchCandidate.updateMany({ where: { id: candidateId, userId: locals.user.id, agentRunId: params.id }, data: { status: 'APPROVED' as any } });
    await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidateId, status: 'pending' }, data: { status: 'approved', approvedAt: new Date() } });
    redirectBack(params.id);
  },

  rejectCandidate: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    if (!candidateId) return fail(400, { error: 'Missing candidate id.' });

    await prisma.researchCandidate.updateMany({ where: { id: candidateId, userId: locals.user.id, agentRunId: params.id }, data: { status: 'REJECTED' as any } });
    await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidateId, status: 'pending' }, data: { status: 'rejected', rejectedAt: new Date() } });
    redirectBack(params.id);
  },

  importCandidate: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    if (!candidateId) return fail(400, { error: 'Missing candidate id.' });

    const candidate = await getOwnedCandidate(locals.user.id, candidateId, params.id);
    if (!candidate) return fail(404, { error: 'Candidate not found.' });

    const name = dec(candidate.nameEnc, 'research_candidate.name', '').trim();
    const website = dec(candidate.websiteEnc, 'research_candidate.website', '').trim();
    const notes = dec(candidate.notesEnc, 'research_candidate.notes', '').trim();
    if (!name) return fail(400, { error: 'Candidate name is missing.' });

    if (candidate.entityType === 'CONTACT') {
      const existing = await prisma.contact.findFirst({ where: { userId: locals.user.id, fullNameIdx: buildIndexToken(name) }, select: { id: true } });
      const contact = existing ?? await prisma.contact.create({
        data: {
          userId: locals.user.id,
          fullNameEnc: encrypt(name, 'contact.fullName'),
          fullNameIdx: buildIndexToken(name),
          companyEnc: website ? encrypt(website, 'contact.company') : null,
          companyIdx: website ? buildIndexToken(website) : null
        }
      });

      await prisma.researchCandidate.update({ where: { id: candidate.id }, data: { status: 'IMPORTED' as any, createdEntityType: 'contact', createdEntityId: contact.id } });
      await prisma.agentRunEntity.create({ data: { agentRunId: params.id, entityType: 'contact', entityId: contact.id, role: 'imported_candidate' } });
      await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidate.id, status: 'pending' }, data: { status: 'approved', approvedAt: new Date(), reviewerNote: 'Imported as contact.' } });
    } else {
      const existing = await prisma.company.findFirst({ where: { userId: locals.user.id, nameIdx: buildIndexToken(name) }, select: { id: true } });
      const company = existing ?? await prisma.company.create({
        data: {
          userId: locals.user.id,
          nameEnc: encrypt(name, 'company.name'),
          nameIdx: buildIndexToken(name),
          websiteEnc: website ? encrypt(website, 'company.website') : null,
          websiteIdx: website ? buildIndexToken(website) : null,
          descriptionEnc: notes ? encrypt(notes, 'company.description') : null,
          kind: 'OPERATING_BUSINESS' as any,
          status: 'WATCHLIST' as any
        }
      });

      await prisma.researchCandidate.update({ where: { id: candidate.id }, data: { status: 'IMPORTED' as any, createdEntityType: 'company', createdEntityId: company.id } });
      await prisma.agentRunEntity.create({ data: { agentRunId: params.id, entityType: 'company', entityId: company.id, role: 'imported_candidate' } });
      await prisma.approvalRequest.updateMany({ where: { userId: locals.user.id, agentRunId: params.id, entityType: 'research_candidate', entityId: candidate.id, status: 'pending' }, data: { status: 'approved', approvedAt: new Date(), reviewerNote: 'Imported as company.' } });
    }

    redirectBack(params.id);
  },

  createReviewTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const candidateId = String(form.get('candidateId') || '').trim();
    const candidate = await getOwnedCandidate(locals.user.id, candidateId, params.id);
    if (!candidate) return fail(404, { error: 'Candidate not found.' });
    const name = dec(candidate.nameEnc, 'research_candidate.name', 'candidate');

    await prisma.task.create({
      data: {
        userId: locals.user.id,
        titleEnc: encrypt(`Review outreach candidate: ${name}`, 'task.title'),
        notesEnc: encrypt(`Review staged Outreach Agent candidate ${name}. Approve/reject, import if useful, and edit outreach before sending anything.`, 'task.notes'),
        status: 'OPEN' as any,
        urgency: 'HIGH' as any,
        importance: 'HIGH' as any,
        taskType: 'REVIEW' as any,
        sourceType: 'research_candidate',
        sourceId: candidate.id
      }
    });

    redirectBack(params.id);
  }
};

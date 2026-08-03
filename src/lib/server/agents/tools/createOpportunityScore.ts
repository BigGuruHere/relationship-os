// src/lib/server/agents/tools/createOpportunityScore.ts
// PURPOSE: Store opportunity scorecards produced by an agent.

import { prisma } from '$lib/db';
import type { ToolDefinition } from '$lib/server/agents/types';

type CreateOpportunityScoreInput = {
  researchCandidateId?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  totalScore?: number;
  sectorFitScore?: number;
  ownerLedScore?: number;
  dealLikelihoodScore?: number;
  outreachFitScore?: number;
  timingScore?: number;
  confidenceScore?: number;
  rationaleJson?: unknown;
};

type CreateOpportunityScoreOutput = {
  id: string;
  createdEntityType: 'opportunity_score';
  createdEntityId: string;
};

function clamp(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export const createOpportunityScoreTool: ToolDefinition<CreateOpportunityScoreInput, CreateOpportunityScoreOutput> = {
  key: 'create_opportunity_score',
  description: 'Stores a structured opportunity scorecard.',
  requiresApproval: false,
  execute: async (input, context) => {
    if (input.researchCandidateId) {
      const ok = await prisma.researchCandidate.findFirst({ where: { id: input.researchCandidateId, userId: context.userId }, select: { id: true } });
      if (!ok) throw new Error('Research candidate not found.');
    }

    const score = await prisma.opportunityScore.create({
      data: {
        userId: context.userId,
        agentRunId: context.agentRunId,
        researchCandidateId: input.researchCandidateId ?? null,
        companyId: input.companyId ?? null,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        totalScore: clamp(input.totalScore),
        sectorFitScore: input.sectorFitScore === undefined ? null : clamp(input.sectorFitScore),
        ownerLedScore: input.ownerLedScore === undefined ? null : clamp(input.ownerLedScore),
        dealLikelihoodScore: input.dealLikelihoodScore === undefined ? null : clamp(input.dealLikelihoodScore),
        outreachFitScore: input.outreachFitScore === undefined ? null : clamp(input.outreachFitScore),
        timingScore: input.timingScore === undefined ? null : clamp(input.timingScore),
        confidenceScore: input.confidenceScore === undefined ? null : clamp(input.confidenceScore),
        rationaleJson: (input.rationaleJson ?? {}) as any
      }
    });

    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: 'opportunity_score',
        entityId: score.id,
        role: 'created_score'
      }
    });

    return { id: score.id, createdEntityType: 'opportunity_score', createdEntityId: score.id };
  }
};

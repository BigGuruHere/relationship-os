// src/lib/server/agents/tools/createOpportunityScore.ts
// PURPOSE: Store explainable opportunity scorecards produced by an agent.

import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import type { ToolDefinition, ToolContext } from '$lib/server/agents/types';
import { createAgentCoreAccess } from '$lib/server/core/accessPolicy';
import { assertOwnedCanonicalRefs } from '$lib/server/core/relationshipRepository';

type ScoreFactorInput = {
  criterionKey: string;
  criterionLabel?: string;
  score?: number;
  weight?: number;
  polarity?: 'positive' | 'negative' | 'neutral' | string;
  confidence?: number;
  evidence?: string;
  rationale?: string;
  sourceUrl?: string;
  metadataJson?: unknown;
};

type CreateOpportunityScoreInput = {
  researchCandidateId?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  scoreVersion?: number;
  scoreLabel?: string;
  priority?: string;
  recommendedAction?: string;
  totalScore?: number;
  sectorFitScore?: number;
  ownerLedScore?: number;
  dealLikelihoodScore?: number;
  outreachFitScore?: number;
  timingScore?: number;
  confidenceScore?: number;
  strategicFitScore?: number;
  valuePotentialScore?: number;
  relationshipPathScore?: number;
  evidenceQualityScore?: number;
  riskScore?: number;
  rationaleJson?: unknown;
  factors?: ScoreFactorInput[];
};

type CreateOpportunityScoreOutput = {
  id: string;
  createdEntityType: 'opportunity_score';
  createdEntityId: string;
  factorCount: number;
};

function clamp(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clean(value: unknown, fallback = '') {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function normaliseLabel(totalScore: number, supplied?: string) {
  const raw = clean(supplied).toLowerCase();
  if (['hot', 'warm', 'watch', 'low', 'reject'].includes(raw)) return raw;
  if (totalScore >= 80) return 'hot';
  if (totalScore >= 65) return 'warm';
  if (totalScore >= 45) return 'watch';
  if (totalScore >= 25) return 'low';
  return 'reject';
}

function normalisePriority(totalScore: number, supplied?: string) {
  const raw = clean(supplied).toLowerCase();
  if (['urgent', 'high', 'medium', 'low'].includes(raw)) return raw;
  if (totalScore >= 80) return 'urgent';
  if (totalScore >= 65) return 'high';
  if (totalScore >= 45) return 'medium';
  return 'low';
}

async function assertOwned(input: CreateOpportunityScoreInput, context: ToolContext) {
  const access = createAgentCoreAccess({ userId: context.userId, contextSpaceId: context.contextSpaceId || context.userId, agentDefinitionId: context.agentDefinitionId, purpose: 'create_opportunity_score' });
  await assertOwnedCanonicalRefs(access, { companyId: input.companyId, contactId: input.contactId, dealId: input.dealId });

  if (input.researchCandidateId) {
    const candidate = await prisma.researchCandidate.findFirst({
      where: { id: input.researchCandidateId, userId: context.userId },
      select: { id: true }
    });
    if (!candidate) throw new Error('Research candidate not found in this workspace.');
  }
}

export const createOpportunityScoreTool: ToolDefinition<CreateOpportunityScoreInput, CreateOpportunityScoreOutput> = {
  key: 'create_opportunity_score',
  description: 'Stores an explainable opportunity scorecard with optional score factors.',
  requiresApproval: false,
  execute: async (input, context) => {
    await assertOwned(input, context);

    const totalScore = clamp(input.totalScore);
    const score = await prisma.opportunityScore.create({
      data: {
        userId: context.userId,
        contextSpaceId: context.contextSpaceId || context.userId,
        agentRunId: context.agentRunId,
        researchCandidateId: input.researchCandidateId ?? null,
        companyId: input.companyId ?? null,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        scoreVersion: Number.isFinite(Number(input.scoreVersion)) ? Math.max(1, Math.round(Number(input.scoreVersion))) : 2,
        scoreLabel: normaliseLabel(totalScore, input.scoreLabel),
        priority: normalisePriority(totalScore, input.priority),
        recommendedAction: clean(input.recommendedAction) || null,
        totalScore,
        sectorFitScore: input.sectorFitScore === undefined ? null : clamp(input.sectorFitScore),
        ownerLedScore: input.ownerLedScore === undefined ? null : clamp(input.ownerLedScore),
        dealLikelihoodScore: input.dealLikelihoodScore === undefined ? null : clamp(input.dealLikelihoodScore),
        outreachFitScore: input.outreachFitScore === undefined ? null : clamp(input.outreachFitScore),
        timingScore: input.timingScore === undefined ? null : clamp(input.timingScore),
        confidenceScore: input.confidenceScore === undefined ? null : clamp(input.confidenceScore),
        strategicFitScore: input.strategicFitScore === undefined ? null : clamp(input.strategicFitScore),
        valuePotentialScore: input.valuePotentialScore === undefined ? null : clamp(input.valuePotentialScore),
        relationshipPathScore: input.relationshipPathScore === undefined ? null : clamp(input.relationshipPathScore),
        evidenceQualityScore: input.evidenceQualityScore === undefined ? null : clamp(input.evidenceQualityScore),
        riskScore: input.riskScore === undefined ? null : clamp(input.riskScore),
        rationaleJson: (input.rationaleJson ?? {}) as any
      }
    });

    const factors = Array.isArray(input.factors) ? input.factors.slice(0, 20) : [];
    if (factors.length) {
      await prisma.opportunityScoreFactor.createMany({
        data: factors.map((factor) => ({
          userId: context.userId,
          contextSpaceId: context.contextSpaceId || context.userId,
          opportunityScoreId: score.id,
          researchCandidateId: input.researchCandidateId ?? null,
          companyId: input.companyId ?? null,
          contactId: input.contactId ?? null,
          dealId: input.dealId ?? null,
          criterionKey: clean(factor.criterionKey, 'unknown').toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 80) || 'unknown',
          criterionLabel: clean(factor.criterionLabel || factor.criterionKey, 'Unknown criterion').slice(0, 160),
          score: clamp(factor.score),
          weight: Math.max(1, Math.min(10, Math.round(Number(factor.weight ?? 1) || 1))),
          polarity: ['positive', 'negative', 'neutral'].includes(clean(factor.polarity).toLowerCase()) ? clean(factor.polarity).toLowerCase() : 'positive',
          confidence: clamp(factor.confidence, 50),
          evidenceEnc: clean(factor.evidence) ? encrypt(clean(factor.evidence), 'opportunity_score_factor.evidence') : null,
          rationaleEnc: clean(factor.rationale) ? encrypt(clean(factor.rationale), 'opportunity_score_factor.rationale') : null,
          sourceUrlEnc: clean(factor.sourceUrl) ? encrypt(clean(factor.sourceUrl), 'opportunity_score_factor.source_url') : null,
          metadataJson: (factor.metadataJson ?? {}) as any
        }))
      });
    }

    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: 'opportunity_score',
        entityId: score.id,
        role: 'created_score'
      }
    });

    return { id: score.id, createdEntityType: 'opportunity_score', createdEntityId: score.id, factorCount: factors.length };
  }
};

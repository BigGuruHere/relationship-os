// src/lib/server/agents/agents/opportunityScoringAgent.ts
// PURPOSE: Stage 4 Opportunity Scoring Agent.
// IT: Scores are advisory prioritisation signals. They do not import, contact, or change source-of-truth CRM records.

import { prisma } from '$lib/db';
import { executeAgentTool } from '$lib/server/agents/toolRegistry';
import { generateStructured } from '$lib/server/agents/modelGateway';
import { createAgentStep, completeAgentStep, failAgentStep } from '$lib/server/agents/agentLogger';
import { completeAgentRun, failAgentRun, startAgentRun } from '$lib/server/agents/runtime';
import { safeDecryptCompany } from '$lib/companies';
import type { AgentEntityType, OpportunityScoringOutput } from '$lib/server/agents/types';

type RunOpportunityScoringAgentInput = {
  userId: string;
  entityType?: AgentEntityType | 'research_candidate';
  entityId?: string;
  targetName?: string;
  targetContext?: string;
  scoringGoal?: string;
  sector?: string;
  buyerMandate?: string;
};

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['targetName', 'totalScore', 'factors', 'rationale', 'risks', 'missingInformation', 'nextActions'],
  properties: {
    targetName: { type: 'string' },
    entityType: { type: 'string' },
    totalScore: { type: 'number' },
    scoreLabel: { type: 'string' },
    priority: { type: 'string' },
    recommendedAction: { type: 'string' },
    sectorFitScore: { type: 'number' },
    ownerLedScore: { type: 'number' },
    dealLikelihoodScore: { type: 'number' },
    outreachFitScore: { type: 'number' },
    timingScore: { type: 'number' },
    confidenceScore: { type: 'number' },
    strategicFitScore: { type: 'number' },
    valuePotentialScore: { type: 'number' },
    relationshipPathScore: { type: 'number' },
    evidenceQualityScore: { type: 'number' },
    riskScore: { type: 'number' },
    factors: { type: 'array', items: { type: 'object' } },
    rationale: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    missingInformation: { type: 'array', items: { type: 'string' } },
    nextActions: { type: 'array', items: { type: 'string' } }
  }
};

function clamp(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clean(value: unknown, fallback = '') {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function cleanLines(values: unknown, fallback: string[] = []) {
  return Array.isArray(values) ? values.map((v) => clean(v)).filter(Boolean).slice(0, 12) : fallback;
}

function scoreLabel(total: number, supplied?: string) {
  const raw = clean(supplied).toLowerCase();
  if (['hot', 'warm', 'watch', 'low', 'reject'].includes(raw)) return raw;
  if (total >= 80) return 'hot';
  if (total >= 65) return 'warm';
  if (total >= 45) return 'watch';
  if (total >= 25) return 'low';
  return 'reject';
}

function priority(total: number, supplied?: string) {
  const raw = clean(supplied).toLowerCase();
  if (['urgent', 'high', 'medium', 'low'].includes(raw)) return raw;
  if (total >= 80) return 'urgent';
  if (total >= 65) return 'high';
  if (total >= 45) return 'medium';
  return 'low';
}

async function loadResearchCandidateContext(userId: string, id: string) {
  const row = await prisma.researchCandidate.findFirst({
    where: { id, userId },
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
      researchSources: {
        select: { titleEnc: true, urlEnc: true, snippetEnc: true, provider: true, confidence: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      opportunityScores: {
        select: { totalScore: true, scoreLabel: true, priority: true, rationaleJson: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3
      }
    }
  });

  if (!row) throw new Error('Research candidate not found.');

  return {
    entityType: 'research_candidate',
    id: row.id,
    candidateType: row.entityType,
    status: row.status,
    name: safeDecryptCompany(row.nameEnc, 'research_candidate.name', 'Untitled candidate'),
    website: safeDecryptCompany(row.websiteEnc, 'research_candidate.website', ''),
    sourceUrl: safeDecryptCompany(row.sourceUrlEnc, 'research_candidate.source_url', ''),
    sourceLabel: safeDecryptCompany(row.sourceLabelEnc, 'research_candidate.source_label', ''),
    confidence: row.confidence,
    notes: safeDecryptCompany(row.notesEnc, 'research_candidate.notes', ''),
    structuredJson: row.structuredJson,
    researchSources: row.researchSources.map((source) => ({
      title: safeDecryptCompany(source.titleEnc, 'research_source.title', ''),
      url: safeDecryptCompany(source.urlEnc, 'research_source.url', ''),
      snippet: safeDecryptCompany(source.snippetEnc, 'research_source.snippet', ''),
      provider: source.provider,
      confidence: source.confidence
    })),
    previousScores: row.opportunityScores
  };
}

function normaliseOutput(raw: OpportunityScoringOutput | null, fallbackName: string): OpportunityScoringOutput {
  const total = clamp(raw?.totalScore, 50);
  const factors = Array.isArray(raw?.factors) ? raw!.factors.slice(0, 12).map((factor: any) => ({
    criterionKey: clean(factor.criterionKey, 'unknown'),
    criterionLabel: clean(factor.criterionLabel || factor.criterionKey, 'Unknown criterion'),
    score: clamp(factor.score, 50),
    weight: Math.max(1, Math.min(10, Math.round(Number(factor.weight ?? 1) || 1))),
    polarity: ['positive', 'negative', 'neutral'].includes(clean(factor.polarity).toLowerCase()) ? clean(factor.polarity).toLowerCase() as any : 'positive',
    confidence: clamp(factor.confidence, 50),
    evidence: clean(factor.evidence),
    rationale: clean(factor.rationale),
    sourceUrl: clean(factor.sourceUrl)
  })) : [];

  return {
    targetName: clean(raw?.targetName, fallbackName) || fallbackName,
    entityType: raw?.entityType,
    totalScore: total,
    scoreLabel: scoreLabel(total, raw?.scoreLabel),
    priority: priority(total, raw?.priority),
    recommendedAction: clean(raw?.recommendedAction) || 'Review manually before outreach or deal action.',
    sectorFitScore: clamp(raw?.sectorFitScore, total),
    ownerLedScore: clamp(raw?.ownerLedScore, total),
    dealLikelihoodScore: clamp(raw?.dealLikelihoodScore, total),
    outreachFitScore: clamp(raw?.outreachFitScore, total),
    timingScore: clamp(raw?.timingScore, total),
    confidenceScore: clamp(raw?.confidenceScore, 50),
    strategicFitScore: clamp(raw?.strategicFitScore, total),
    valuePotentialScore: clamp(raw?.valuePotentialScore, total),
    relationshipPathScore: clamp(raw?.relationshipPathScore, 50),
    evidenceQualityScore: clamp(raw?.evidenceQualityScore, 50),
    riskScore: clamp(raw?.riskScore, 50),
    factors,
    rationale: cleanLines(raw?.rationale, ['Scored from supplied context.']),
    risks: cleanLines(raw?.risks, ['Evidence may be incomplete.']),
    missingInformation: cleanLines(raw?.missingInformation, ['Confirm role, contact details, owner intent, and commercial size before prioritising.']),
    nextActions: cleanLines(raw?.nextActions, ['Review evidence.', 'Confirm contact details.', 'Decide whether to import or contact.'])
  };
}

function markdownScorecard(output: OpportunityScoringOutput) {
  const factors = output.factors.length
    ? output.factors.map((f) => `- ${f.criterionLabel}: ${f.score}/100 - ${f.rationale || f.evidence || 'No rationale supplied.'}`).join('\n')
    : '- No score factors supplied.';

  return [
    `# Opportunity scorecard: ${output.targetName}`,
    '',
    `Total score: ${output.totalScore}/100`,
    `Label: ${output.scoreLabel || 'watch'}`,
    `Priority: ${output.priority || 'medium'}`,
    `Recommended action: ${output.recommendedAction || 'Review manually.'}`,
    '',
    '## Factor scores',
    factors,
    '',
    '## Rationale',
    ...(output.rationale.length ? output.rationale.map((x) => `- ${x}`) : ['- No rationale supplied.']),
    '',
    '## Risks',
    ...(output.risks.length ? output.risks.map((x) => `- ${x}`) : ['- No risks supplied.']),
    '',
    '## Missing information',
    ...(output.missingInformation.length ? output.missingInformation.map((x) => `- ${x}`) : ['- No missing information listed.']),
    '',
    '## Next actions',
    ...(output.nextActions.length ? output.nextActions.map((x) => `- ${x}`) : ['- Review before action.'])
  ].join('\n');
}

export async function runOpportunityScoringAgent(input: RunOpportunityScoringAgentInput) {
  const triggerEntityType = input.entityType && input.entityId ? input.entityType : undefined;
  const triggerEntityId = input.entityType && input.entityId ? input.entityId : undefined;

  const { agent, activePrompt, run } = await startAgentRun({
    userId: input.userId,
    agentKey: 'opportunity_scoring_agent',
    triggerType: 'manual',
    triggerEntityType,
    triggerEntityId,
    inputJson: {
      entityType: input.entityType,
      entityId: input.entityId,
      targetName: input.targetName,
      sector: input.sector,
      scoringGoal: input.scoringGoal,
      buyerMandateChars: input.buyerMandate?.length ?? 0,
      targetContextChars: input.targetContext?.length ?? 0
    }
  });

  try {
    const readStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'read_scoring_context',
      stepName: 'Read target context for scoring',
      inputJson: { entityType: input.entityType, entityId: input.entityId }
    });

    let entityContext: any = null;
    if (input.entityType && input.entityId) {
      if (input.entityType === 'research_candidate') {
        entityContext = await loadResearchCandidateContext(input.userId, input.entityId);
        await prisma.agentRunEntity.create({ data: { agentRunId: run.id, entityType: 'research_candidate', entityId: input.entityId, role: 'score_target' } });
      } else {
        entityContext = await executeAgentTool<any, any>('read_entity_context', {
          entityType: input.entityType,
          entityId: input.entityId
        }, { userId: input.userId, agentRunId: run.id, agentStepId: readStep.id, agentDefinitionId: agent.id });
      }
    }

    await completeAgentStep(readStep.id, { hasEntityContext: Boolean(entityContext) });

    const modelStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'score_opportunity',
      stepName: 'Generate explainable opportunity scorecard',
      inputJson: { entityType: input.entityType, entityId: input.entityId, hasEntityContext: Boolean(entityContext) }
    });

    const fallbackName = clean(input.targetName || entityContext?.name || entityContext?.title || entityContext?.targetName, 'Untitled target');
    let structured: OpportunityScoringOutput | null = null;
    try {
      const result = await generateStructured<OpportunityScoringOutput>({
        userId: input.userId,
        agentRunId: run.id,
        agentStepId: modelStep.id,
        provider: agent.defaultModelProvider,
        model: agent.defaultModelName,
        purpose: 'opportunity_scoring_v2',
        systemPrompt: activePrompt?.systemPrompt ?? agent.systemPrompt,
        outputSchema: activePrompt?.outputSchemaJson ?? agent.outputSchemaJson ?? OUTPUT_SCHEMA,
        userPrompt: [
          activePrompt?.instructions ?? agent.instructions ?? '',
          '',
          `Scoring goal: ${input.scoringGoal || 'Prioritise business-broker outreach and next action.'}`,
          `Sector: ${input.sector || 'Not specified'}`,
          `Buyer mandate / opportunity context: ${input.buyerMandate || 'Not specified'}`,
          `Target name: ${fallbackName}`,
          '',
          'Relish entity context:',
          JSON.stringify(entityContext ?? {}, null, 2),
          '',
          'Additional user supplied context:',
          input.targetContext || 'No additional context supplied.'
        ].join('\n')
      });
      structured = result.structured;
    } catch (error) {
      structured = {
        targetName: fallbackName,
        totalScore: 40,
        scoreLabel: 'watch',
        priority: 'medium',
        recommendedAction: 'Review manually because the model score could not be generated.',
        confidenceScore: 25,
        evidenceQualityScore: entityContext || input.targetContext ? 35 : 10,
        factors: [{
          criterionKey: 'fallback_score',
          criterionLabel: 'Fallback score',
          score: 40,
          confidence: 25,
          rationale: error instanceof Error ? error.message : String(error)
        }],
        rationale: ['Fallback score created because model generation failed.'],
        risks: ['Score has low confidence.'],
        missingInformation: ['Run the scoring agent again after checking model/API configuration.'],
        nextActions: ['Review the target manually.']
      } as OpportunityScoringOutput;
    }

    const output = normaliseOutput(structured, fallbackName);
    await completeAgentStep(modelStep.id, { totalScore: output.totalScore, label: output.scoreLabel, factorCount: output.factors.length });

    const stageStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'store_scorecard',
      stepName: 'Store scorecard, factors, and artifact',
      inputJson: { targetName: output.targetName, totalScore: output.totalScore }
    });

    const score = await executeAgentTool<any, any>('create_opportunity_score', {
      researchCandidateId: input.entityType === 'research_candidate' ? input.entityId : undefined,
      companyId: input.entityType === 'company' ? input.entityId : undefined,
      contactId: input.entityType === 'contact' ? input.entityId : undefined,
      dealId: input.entityType === 'deal' ? input.entityId : undefined,
      scoreVersion: 2,
      scoreLabel: output.scoreLabel,
      priority: output.priority,
      recommendedAction: output.recommendedAction,
      totalScore: output.totalScore,
      sectorFitScore: output.sectorFitScore,
      ownerLedScore: output.ownerLedScore,
      dealLikelihoodScore: output.dealLikelihoodScore,
      outreachFitScore: output.outreachFitScore,
      timingScore: output.timingScore,
      confidenceScore: output.confidenceScore,
      strategicFitScore: output.strategicFitScore,
      valuePotentialScore: output.valuePotentialScore,
      relationshipPathScore: output.relationshipPathScore,
      evidenceQualityScore: output.evidenceQualityScore,
      riskScore: output.riskScore,
      rationaleJson: {
        rationale: output.rationale,
        risks: output.risks,
        missingInformation: output.missingInformation,
        nextActions: output.nextActions
      },
      factors: output.factors
    }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

    await executeAgentTool<any, any>('create_agent_artifact', {
      artifactType: 'opportunity_scorecard',
      title: `Opportunity scorecard: ${output.targetName}`,
      content: markdownScorecard(output),
      summary: `${output.scoreLabel || 'watch'} / ${output.priority || 'medium'} - ${output.totalScore}/100. ${output.recommendedAction || ''}`.trim(),
      structuredJson: { ...output, opportunityScoreId: score.id },
      entityType: (input.entityType as any) || 'opportunity_score',
      entityId: input.entityId || score.id
    }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

    if (['hot', 'warm'].includes(String(output.scoreLabel || ''))) {
      await executeAgentTool<any, any>('create_task', {
        title: `Review scored opportunity: ${output.targetName}`,
        notes: `Opportunity Scoring Agent rated this ${output.scoreLabel} (${output.totalScore}/100). Recommended action: ${output.recommendedAction || 'Review manually.'}`,
        urgency: output.priority === 'urgent' ? 'URGENT' : 'HIGH',
        importance: 'HIGH',
        taskType: 'REVIEW',
        sourceType: 'opportunity_score',
        sourceId: score.id
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });
    }

    await completeAgentStep(stageStep.id, { opportunityScoreId: score.id, factorCount: score.factorCount });
    await completeAgentRun(run.id, { opportunityScoreId: score.id, totalScore: output.totalScore, scoreLabel: output.scoreLabel, priority: output.priority });
    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  } catch (error) {
    const runningStep = await prisma.agentStep.findFirst({ where: { agentRunId: run.id, status: 'running' }, orderBy: { createdAt: 'desc' } });
    if (runningStep) await failAgentStep(runningStep.id, error);
    await failAgentRun(run.id, error);
    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  }
}

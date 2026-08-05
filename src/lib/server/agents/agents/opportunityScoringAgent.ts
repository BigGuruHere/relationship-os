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

function scoreFromFactors(factors: OpportunityScoringOutput['factors'], aliases: string[], fallback: unknown, defaultValue: number) {
  const lowered = aliases.map((alias) => alias.toLowerCase());
  const match = factors.find((factor: any) => {
    const key = clean(factor.criterionKey).toLowerCase();
    const label = clean(factor.criterionLabel).toLowerCase();
    return lowered.some((alias) => key.includes(alias) || label.includes(alias));
  });
  return clamp(match?.score ?? fallback, defaultValue);
}

function hasUsableUrl(value: unknown) {
  const text = clean(value);
  return /^https?:\/\//i.test(text) ? text : '';
}

function combinedContextText(...parts: unknown[]) {
  return parts.map((part) => {
    if (!part) return '';
    if (typeof part === 'string') return part;
    try { return JSON.stringify(part); } catch { return String(part); }
  }).join(' ').toLowerCase();
}

function detectSoftSellerInterest(text: string) {
  const signals = [
    'would consider',
    'open to a conversation',
    'open to discussions',
    'open to discussing',
    'quiet conversation',
    'serious buyer',
    'right price',
    'reducing workload',
    'reduce workload',
    'stepping back',
    'step back',
    'partial exit',
    'selling part',
    'selling all',
    'sell part',
    'sell all',
    'client care is protected',
    'for the right buyer'
  ];
  return signals.some((signal) => text.includes(signal));
}

function isGenericRecommendedAction(value: string) {
  const text = value.toLowerCase();
  return !text || text.includes('review manually before outreach or deal action') || text === 'review manually.';
}

function recommendedActionFor(output: OpportunityScoringOutput, contextText: string) {
  const label = String(output.scoreLabel || 'watch').toLowerCase();
  const softInterest = detectSoftSellerInterest(contextText);
  const noDecisionMaker = contextText.includes('no visible individual owner') || contextText.includes('no clear decision-maker') || contextText.includes('unclear decision-making');

  if (softInterest) {
    return 'Call or email with a soft relevance-check. Confirm whether they would speak with Sam or a serious buyer under NDA; do not frame it as a sale process yet.';
  }
  if (label === 'hot') {
    return 'Prioritise a human follow-up after reviewing evidence. Create or update a deal only if the interest signal is confirmed.';
  }
  if (label === 'warm') {
    return 'Confirm contact details, then use a low-pressure first contact. Keep it as outreach until interest is confirmed.';
  }
  if (label === 'watch' || noDecisionMaker) {
    return 'Research further and confirm the decision-maker, contact details, and relationship path before outreach.';
  }
  if (label === 'low' || label === 'reject') {
    return 'Low priority. Monitor only unless you identify a decision-maker, relationship path, or seller-intent signal.';
  }
  return 'Review evidence, confirm contact details, and choose the next human action.';
}

function dealActionGuidance(output: OpportunityScoringOutput, contextText: string) {
  const softInterest = detectSoftSellerInterest(contextText);
  const label = String(output.scoreLabel || 'watch').toLowerCase();
  if (softInterest || label === 'hot') {
    return 'Create or update a deal only after you confirm the interest signal in a human conversation. If the contact only expressed curiosity, keep the record as company/contact plus task.';
  }
  if (label === 'warm') {
    return 'Do not create a deal yet unless there is a real seller-interest signal. Keep this as company/contact outreach with a task.';
  }
  return 'Do not create a deal. Keep this as research/watchlist until evidence of interest or a relationship path appears.';
}

function calibrateOutput(output: OpportunityScoringOutput, contextText: string): OpportunityScoringOutput {
  const softInterest = detectSoftSellerInterest(contextText);
  let next = { ...output };

  if (softInterest) {
    next = {
      ...next,
      dealLikelihoodScore: Math.max(clamp(next.dealLikelihoodScore, next.totalScore), 68),
      outreachFitScore: Math.max(clamp(next.outreachFitScore, next.totalScore), 78),
      timingScore: Math.max(clamp(next.timingScore, next.totalScore), 68),
      evidenceQualityScore: Math.max(clamp(next.evidenceQualityScore, 50), 65),
      totalScore: Math.max(next.totalScore, Math.min(82, next.totalScore + 8))
    };
    next.scoreLabel = scoreLabel(next.totalScore, next.scoreLabel === 'watch' || next.scoreLabel === 'low' ? 'warm' : next.scoreLabel);
    next.priority = priority(next.totalScore, next.priority === 'medium' || next.priority === 'low' ? 'high' : next.priority);
  }

  if (isGenericRecommendedAction(clean(next.recommendedAction))) {
    next.recommendedAction = recommendedActionFor(next, contextText);
  }

  return {
    ...next,
    rationale: cleanLines(next.rationale, ['Scored from supplied context.']),
    risks: cleanLines(next.risks, ['Evidence may be incomplete.']),
    missingInformation: cleanLines(next.missingInformation, ['Confirm role, contact details, owner intent, and commercial size before prioritising.']),
    nextActions: cleanLines(next.nextActions, ['Review evidence.', 'Confirm contact details.', 'Decide whether to import or contact.'])
  };
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
    polarity: clean(factor.criterionKey || factor.criterionLabel).toLowerCase().includes('risk')
      ? 'negative'
      : (['positive', 'negative', 'neutral'].includes(clean(factor.polarity).toLowerCase()) ? clean(factor.polarity).toLowerCase() as any : 'positive'),
    confidence: clamp(factor.confidence, 50),
    evidence: clean(factor.evidence),
    rationale: clean(factor.rationale),
    sourceUrl: hasUsableUrl(factor.sourceUrl)
  })) : [];

  return {
    targetName: clean(raw?.targetName, fallbackName) || fallbackName,
    entityType: raw?.entityType,
    totalScore: total,
    scoreLabel: scoreLabel(total, raw?.scoreLabel),
    priority: priority(total, raw?.priority),
    recommendedAction: clean(raw?.recommendedAction) || 'Review manually before outreach or deal action.',
    sectorFitScore: scoreFromFactors(factors, ['sector'], raw?.sectorFitScore, total),
    ownerLedScore: scoreFromFactors(factors, ['owner', 'principal', 'founder'], raw?.ownerLedScore, total),
    dealLikelihoodScore: scoreFromFactors(factors, ['deal likelihood', 'deal_likelihood'], raw?.dealLikelihoodScore, total),
    outreachFitScore: scoreFromFactors(factors, ['outreach'], raw?.outreachFitScore, total),
    timingScore: scoreFromFactors(factors, ['timing'], raw?.timingScore, total),
    confidenceScore: scoreFromFactors(factors, ['confidence'], raw?.confidenceScore, 50),
    strategicFitScore: scoreFromFactors(factors, ['strategic'], raw?.strategicFitScore, total),
    valuePotentialScore: scoreFromFactors(factors, ['value'], raw?.valuePotentialScore, total),
    relationshipPathScore: scoreFromFactors(factors, ['relationship'], raw?.relationshipPathScore, 50),
    evidenceQualityScore: scoreFromFactors(factors, ['evidence'], raw?.evidenceQualityScore, 50),
    riskScore: scoreFromFactors(factors, ['risk'], raw?.riskScore, 50),
    factors,
    rationale: cleanLines(raw?.rationale, ['Scored from supplied context.']),
    risks: cleanLines(raw?.risks, ['Evidence may be incomplete.']),
    missingInformation: cleanLines(raw?.missingInformation, ['Confirm role, contact details, owner intent, and commercial size before prioritising.']),
    nextActions: cleanLines(raw?.nextActions, ['Review evidence.', 'Confirm contact details.', 'Decide whether to import or contact.'])
  };
}

function markdownScorecard(output: OpportunityScoringOutput, contextText = '') {
  const factors = output.factors.length
    ? output.factors.map((f) => `- ${f.criterionLabel}: ${f.score}/100 - ${f.rationale || f.evidence || 'No rationale supplied.'}`).join('\n')
    : '- No score factors supplied.';
  const dealGuidance = dealActionGuidance(output, contextText);

  return [
    `# Opportunity scorecard: ${output.targetName}`,
    '',
    `Total score: ${output.totalScore}/100`,
    `Label: ${output.scoreLabel || 'watch'}`,
    `Priority: ${output.priority || 'medium'}`,
    `Recommended action: ${output.recommendedAction || 'Review manually.'}`,
    `Deal guidance: ${dealGuidance}`,
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

    const contextText = combinedContextText(entityContext, input.targetContext, input.buyerMandate, input.scoringGoal);
    const output = calibrateOutput(normaliseOutput(structured, fallbackName), contextText);
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
        nextActions: output.nextActions,
        dealActionGuidance: dealActionGuidance(output, contextText),
        softSellerInterestSignal: detectSoftSellerInterest(contextText)
      },
      factors: output.factors
    }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

    await executeAgentTool<any, any>('create_agent_artifact', {
      artifactType: 'opportunity_scorecard',
      title: `Opportunity scorecard: ${output.targetName}`,
      content: markdownScorecard(output, contextText),
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

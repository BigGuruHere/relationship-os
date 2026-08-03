// src/lib/server/agents/agents/outreachAgent.ts
// PURPOSE: Stage 2 safe Outreach Agent. It stages candidates, scores them, creates approval requests, drafts outreach artifacts, and creates review tasks.

import { prisma } from '$lib/db';
import { executeAgentTool } from '$lib/server/agents/toolRegistry';
import { generateStructured } from '$lib/server/agents/modelGateway';
import { createAgentStep, completeAgentStep, failAgentStep } from '$lib/server/agents/agentLogger';
import { completeAgentRun, failAgentRun, startAgentRun } from '$lib/server/agents/runtime';
import type { OutreachAgentOutput, OutreachCandidateOutput } from '$lib/server/agents/types';

type RunOutreachAgentInput = {
  userId: string;
  sector: string;
  geography?: string;
  targetDescription?: string;
  outreachGoal?: string;
  sourceText?: string;
  maxCandidates?: number;
  projectId?: string;
  dealId?: string;
};

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['candidates', 'runBriefing'],
  properties: {
    candidates: { type: 'array' },
    runBriefing: { type: 'object' }
  }
};

function clampScore(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function cleanText(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function normaliseCandidate(raw: OutreachCandidateOutput): OutreachCandidateOutput | null {
  const name = cleanText(raw?.name);
  if (!name) return null;

  return {
    entityType: raw.entityType === 'CONTACT' ? 'CONTACT' : 'COMPANY',
    name,
    website: cleanText(raw.website),
    sourceUrl: cleanText(raw.sourceUrl),
    sourceLabel: cleanText(raw.sourceLabel),
    confidence: clampScore(raw.confidence, 50),
    notes: cleanText(raw.notes),
    totalScore: clampScore(raw.totalScore, 50),
    sectorFitScore: clampScore(raw.sectorFitScore, 50),
    ownerLedScore: clampScore(raw.ownerLedScore, 50),
    dealLikelihoodScore: clampScore(raw.dealLikelihoodScore, 50),
    outreachFitScore: clampScore(raw.outreachFitScore, 50),
    timingScore: clampScore(raw.timingScore, 50),
    confidenceScore: clampScore(raw.confidenceScore, 50),
    scoreRationale: Array.isArray(raw.scoreRationale) ? raw.scoreRationale.map((x) => cleanText(x)).filter(Boolean).slice(0, 8) : [],
    outreachAngle: cleanText(raw.outreachAngle),
    draftSubject: cleanText(raw.draftSubject),
    draftBody: cleanText(raw.draftBody),
    nextActionTitle: cleanText(raw.nextActionTitle) || `Review outreach candidate: ${name}`
  };
}

function fallbackCandidates(input: RunOutreachAgentInput): OutreachCandidateOutput[] {
  const lines = String(input.sourceText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, input.maxCandidates || 5);

  return lines.map((line) => ({
    entityType: 'COMPANY',
    name: line.replace(/^[-*\d.\s]+/, '').slice(0, 120),
    confidence: 35,
    totalScore: 40,
    sectorFitScore: 40,
    ownerLedScore: 30,
    dealLikelihoodScore: 35,
    outreachFitScore: 45,
    timingScore: 30,
    confidenceScore: 35,
    scoreRationale: ['Fallback extraction from pasted text because the model output was not available.'],
    outreachAngle: `Possible ${input.sector || 'business broking'} outreach candidate. Review before importing.`,
    draftSubject: 'Quick question',
    draftBody: 'Hi,\n\nI came across your business and wondered whether a short conversation might make sense.\n\nRegards',
    nextActionTitle: `Review outreach candidate: ${line.slice(0, 80)}`
  }));
}

function outreachDraftMarkdown(candidate: OutreachCandidateOutput) {
  const rationale = Array.isArray(candidate.scoreRationale) && candidate.scoreRationale.length
    ? candidate.scoreRationale.map((item) => `- ${item}`).join('\n')
    : '- No specific rationale supplied.';

  return [
    `# Outreach draft: ${candidate.name}`,
    '',
    `## Opportunity angle`,
    candidate.outreachAngle || 'Review opportunity angle before sending.',
    '',
    `## Score rationale`,
    rationale,
    '',
    `## Draft subject`,
    candidate.draftSubject || 'Quick question',
    '',
    `## Draft body`,
    candidate.draftBody || 'Draft body not generated.'
  ].join('\n').trim();
}

export async function runOutreachAgent(input: RunOutreachAgentInput) {
  const { agent, activePrompt, run } = await startAgentRun({
    userId: input.userId,
    agentKey: 'outreach_agent',
    triggerType: 'manual',
    triggerEntityType: input.projectId ? 'project' : input.dealId ? 'deal' : undefined,
    triggerEntityId: input.projectId || input.dealId || undefined,
    inputJson: {
      sector: input.sector,
      geography: input.geography,
      targetDescription: input.targetDescription,
      outreachGoal: input.outreachGoal,
      maxCandidates: input.maxCandidates,
      projectId: input.projectId,
      dealId: input.dealId,
      sourceTextChars: input.sourceText?.length ?? 0
    }
  });

  try {
    if (input.projectId) {
      await prisma.agentRunEntity.create({ data: { agentRunId: run.id, entityType: 'project', entityId: input.projectId, role: 'outreach_context' } });
    }
    if (input.dealId) {
      await prisma.agentRunEntity.create({ data: { agentRunId: run.id, entityType: 'deal', entityId: input.dealId, role: 'outreach_context' } });
    }

    const modelStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'generate_candidates',
      stepName: 'Generate staged outreach candidates',
      inputJson: {
        sector: input.sector,
        geography: input.geography,
        targetDescription: input.targetDescription,
        outreachGoal: input.outreachGoal,
        maxCandidates: input.maxCandidates,
        sourceTextChars: input.sourceText?.length ?? 0
      }
    });

    let modelOutput: OutreachAgentOutput | null = null;
    try {
      const modelResult = await generateStructured<OutreachAgentOutput>({
        userId: input.userId,
        agentRunId: run.id,
        agentStepId: modelStep.id,
        provider: agent.defaultModelProvider,
        model: agent.defaultModelName,
        purpose: 'outreach_candidates',
        systemPrompt: activePrompt?.systemPrompt ?? agent.systemPrompt,
        outputSchema: activePrompt?.outputSchemaJson ?? agent.outputSchemaJson ?? OUTPUT_SCHEMA,
        userPrompt: [
          activePrompt?.instructions ?? agent.instructions ?? '',
          '',
          `Sector: ${input.sector}`,
          `Geography: ${input.geography || 'Not specified'}`,
          `Target description: ${input.targetDescription || 'Not specified'}`,
          `Outreach goal: ${input.outreachGoal || 'Find suitable business-broker outreach candidates.'}`,
          `Maximum candidates: ${input.maxCandidates || 5}`,
          '',
          'Source/research text supplied by user:',
          input.sourceText || 'No source text supplied. If no source text is supplied, create a conservative research plan and no more than two low-confidence candidate placeholders.'
        ].join('\n')
      });
      modelOutput = modelResult.structured;
    } catch (error) {
      // IT: Keep the run useful even if model generation fails by staging low-confidence rows from pasted text.
      modelOutput = { candidates: fallbackCandidates(input), runBriefing: { summary: error instanceof Error ? error.message : String(error) } };
    }

    const rawCandidates = Array.isArray(modelOutput?.candidates) ? modelOutput!.candidates : fallbackCandidates(input);
    const max = Math.max(1, Math.min(25, Number(input.maxCandidates || 5)));
    const candidates = rawCandidates.map(normaliseCandidate).filter(Boolean).slice(0, max) as OutreachCandidateOutput[];
    await completeAgentStep(modelStep.id, { candidateCount: candidates.length });

    const stageStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'stage_candidates',
      stepName: 'Stage candidates, scores, approvals, drafts, and tasks',
      inputJson: { candidateCount: candidates.length }
    });

    const created: any[] = [];
    for (const candidate of candidates) {
      const staged = await executeAgentTool<any, any>('create_research_candidate', {
        entityType: candidate.entityType,
        name: candidate.name,
        website: candidate.website,
        sourceUrl: candidate.sourceUrl,
        sourceLabel: candidate.sourceLabel,
        confidence: candidate.confidence,
        notes: candidate.notes || candidate.outreachAngle,
        structuredJson: candidate
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

      const score = await executeAgentTool<any, any>('create_opportunity_score', {
        researchCandidateId: staged.id,
        totalScore: candidate.totalScore,
        sectorFitScore: candidate.sectorFitScore,
        ownerLedScore: candidate.ownerLedScore,
        dealLikelihoodScore: candidate.dealLikelihoodScore,
        outreachFitScore: candidate.outreachFitScore,
        timingScore: candidate.timingScore,
        confidenceScore: candidate.confidenceScore,
        rationaleJson: {
          rationale: candidate.scoreRationale || [],
          outreachAngle: candidate.outreachAngle || ''
        }
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

      const draft = await executeAgentTool<any, any>('create_agent_artifact', {
        artifactType: 'outreach_draft',
        title: `Outreach draft: ${candidate.name}`,
        content: outreachDraftMarkdown(candidate),
        summary: candidate.outreachAngle || `Draft outreach for ${candidate.name}`,
        structuredJson: candidate,
        entityType: 'research_candidate',
        entityId: staged.id
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

      const approval = await executeAgentTool<any, any>('create_approval_request', {
        actionType: 'review_outreach_candidate',
        entityType: 'research_candidate',
        entityId: staged.id,
        proposedActionJson: {
          candidateId: staged.id,
          candidateName: candidate.name,
          recommendedAction: 'Review, approve/reject, and optionally import into CRM before sending outreach.',
          draftArtifactId: draft.id
        },
        proposedDiffJson: candidate
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

      created.push({ candidateId: staged.id, scoreId: score.id, draftArtifactId: draft.id, approvalId: approval.id });
    }

    if (created.length) {
      await executeAgentTool<any, any>('create_task', {
        title: `Review ${created.length} outreach candidate${created.length === 1 ? '' : 's'} for ${input.sector}`,
        notes: `Outreach Agent staged ${created.length} candidate${created.length === 1 ? '' : 's'}. Review the candidates and approve, reject, or import them before outreach.`,
        urgency: 'HIGH',
        importance: 'HIGH',
        taskType: 'REVIEW',
        projectId: input.projectId,
        dealId: input.dealId,
        sourceType: 'agent_run',
        sourceId: run.id
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });
    }

    await completeAgentStep(stageStep.id, { created });

    const brief = modelOutput?.runBriefing || {};
    const briefingTitle = cleanText(brief.title, `Outreach briefing: ${input.sector}`) || `Outreach briefing: ${input.sector}`;
    const briefingSummary = cleanText(brief.summary, `${created.length} candidates staged for human review.`) || `${created.length} candidates staged for human review.`;
    const nextActions = Array.isArray(brief.recommendedNextActions) ? brief.recommendedNextActions.map(cleanText).filter(Boolean) : [];

    const briefingContent = [
      `# ${briefingTitle}`,
      '',
      briefingSummary,
      '',
      '## Inputs',
      `- Sector: ${input.sector}`,
      `- Geography: ${input.geography || 'Not specified'}`,
      `- Target: ${input.targetDescription || 'Not specified'}`,
      `- Goal: ${input.outreachGoal || 'Not specified'}`,
      '',
      '## Candidates staged',
      ...candidates.map((c) => `- ${c.name} - score ${c.totalScore ?? 0}/100 - ${c.outreachAngle || 'Review needed'}`),
      '',
      '## Recommended next actions',
      ...(nextActions.length ? nextActions.map((a) => `- ${a}`) : ['- Review candidate approvals.', '- Import approved candidates into CRM.', '- Edit drafts before sending any outreach.'])
    ].join('\n');

    await executeAgentTool<any, any>('create_agent_artifact', {
      artifactType: 'outreach_briefing',
      title: briefingTitle,
      content: briefingContent,
      summary: briefingSummary,
      structuredJson: { input, candidates, created, runBriefing: brief },
      entityType: input.projectId ? 'project' : input.dealId ? 'deal' : undefined,
      entityId: input.projectId || input.dealId || undefined
    }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

    await completeAgentRun(run.id, { candidateCount: created.length, candidates: created });
    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  } catch (error) {
    const runningStep = await prisma.agentStep.findFirst({ where: { agentRunId: run.id, status: 'running' }, orderBy: { createdAt: 'desc' } });
    if (runningStep) await failAgentStep(runningStep.id, error);
    await failAgentRun(run.id, error);
    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  }
}

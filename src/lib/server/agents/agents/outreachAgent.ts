// src/lib/server/agents/agents/outreachAgent.ts
// PURPOSE: Stage 3 safe Outreach Agent.
// IT: It can optionally run controlled web research, stage company/contact candidates, log sources, score opportunities, create drafts/approvals/tasks, and never send email or import CRM records automatically.

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
  enableWebResearch?: boolean;
  findContacts?: boolean;
  researchProvider?: string;
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
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function cleanMultiline(value: unknown, fallback = '') {
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
    notes: cleanMultiline(raw.notes),
    totalScore: clampScore(raw.totalScore, 50),
    sectorFitScore: clampScore(raw.sectorFitScore, 50),
    ownerLedScore: clampScore(raw.ownerLedScore, 50),
    dealLikelihoodScore: clampScore(raw.dealLikelihoodScore, 50),
    outreachFitScore: clampScore(raw.outreachFitScore, 50),
    timingScore: clampScore(raw.timingScore, 50),
    confidenceScore: clampScore(raw.confidenceScore, 50),
    scoreRationale: Array.isArray(raw.scoreRationale) ? raw.scoreRationale.map((x) => cleanText(x)).filter(Boolean).slice(0, 8) : [],
    outreachAngle: cleanMultiline(raw.outreachAngle),
    draftSubject: cleanText(raw.draftSubject),
    draftBody: cleanMultiline(raw.draftBody),
    nextActionTitle: cleanText(raw.nextActionTitle) || `Review outreach candidate: ${name}`,
    roleTitle: cleanText(raw.roleTitle),
    companyName: cleanText(raw.companyName),
    contactResearchReason: cleanMultiline(raw.contactResearchReason),
    sourceEvidence: Array.isArray((raw as any).sourceEvidence) ? (raw as any).sourceEvidence.slice(0, 8) : []
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
  const evidence = Array.isArray(candidate.sourceEvidence) && candidate.sourceEvidence.length
    ? candidate.sourceEvidence.map((item: any) => `- ${item.title || item.url || 'Source'}${item.url ? ` - ${item.url}` : ''}${item.snippet ? ` - ${item.snippet}` : ''}`).join('\n')
    : '- No source evidence attached.';

  return [
    `# Outreach draft: ${candidate.name}`,
    '',
    candidate.entityType === 'CONTACT' ? `Role/title: ${candidate.roleTitle || 'Unknown'}` : '',
    candidate.companyName ? `Company: ${candidate.companyName}` : '',
    '',
    '## Opportunity angle',
    candidate.outreachAngle || 'Review opportunity angle before sending.',
    '',
    '## Score rationale',
    rationale,
    '',
    '## Evidence',
    evidence,
    '',
    '## Draft subject',
    candidate.draftSubject || 'Quick question',
    '',
    '## Draft body',
    candidate.draftBody || 'Draft body not generated.'
  ].filter((line) => line !== '').join('\n').trim();
}

function buildSearchQueries(input: RunOutreachAgentInput) {
  const sector = cleanText(input.sector);
  const geography = cleanText(input.geography);
  const target = cleanText(input.targetDescription);
  const geoPart = geography ? ` ${geography}` : '';
  const targetPart = target ? ` ${target}` : '';
  const contactPart = input.findContacts ? ' owner OR founder OR director OR principal OR CEO' : '';

  const queries = [
    `${sector}${geoPart}${targetPart} businesses`,
    `${sector}${geoPart} company owner founder director`,
    `${sector}${geoPart} business directory${contactPart}`
  ];

  return Array.from(new Set(queries.map((q) => q.replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, 3);
}

function sourcesToText(sources: any[]) {
  if (!sources.length) return '';
  return sources.map((source, i) => [
    `Source ${i + 1}:`,
    `Title: ${source.title || ''}`,
    `URL: ${source.url || ''}`,
    `Snippet: ${source.snippet || ''}`
  ].join('\n')).join('\n\n');
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
      enableWebResearch: input.enableWebResearch ?? false,
      findContacts: input.findContacts ?? false,
      researchProvider: input.researchProvider || 'auto',
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

    const researchSources: any[] = [];
    if (input.enableWebResearch) {
      const researchStep = await createAgentStep({
        agentRunId: run.id,
        stepKey: 'live_web_research',
        stepName: 'Run controlled live web research',
        inputJson: { queries: buildSearchQueries(input), provider: input.researchProvider || 'auto' }
      });

      for (const query of buildSearchQueries(input)) {
        const search = await executeAgentTool<any, any>('research_web_search', {
          query,
          maxResults: Math.max(3, Math.min(10, Number(input.maxCandidates || 5))),
          provider: input.researchProvider || undefined,
          purpose: 'outreach_candidate_discovery'
        }, { userId: input.userId, agentRunId: run.id, agentStepId: researchStep.id, agentDefinitionId: agent.id });

        for (const result of search.results || []) {
          const source = await executeAgentTool<any, any>('create_research_source', {
            sourceType: 'SEARCH_RESULT',
            provider: search.provider,
            query,
            title: result.title,
            url: result.url,
            snippet: result.snippet,
            evidenceJson: result,
            confidence: 60
          }, { userId: input.userId, agentRunId: run.id, agentStepId: researchStep.id, agentDefinitionId: agent.id });
          researchSources.push({ ...result, researchSourceId: source.id, query, provider: search.provider });
        }
      }

      await completeAgentStep(researchStep.id, { sourceCount: researchSources.length, provider: input.researchProvider || 'auto' });
    }

    const modelStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'generate_candidates',
      stepName: 'Generate staged outreach candidates from sources',
      inputJson: {
        sector: input.sector,
        geography: input.geography,
        targetDescription: input.targetDescription,
        outreachGoal: input.outreachGoal,
        maxCandidates: input.maxCandidates,
        findContacts: input.findContacts ?? false,
        sourceTextChars: input.sourceText?.length ?? 0,
        researchSourceCount: researchSources.length
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
        purpose: 'outreach_candidates_stage3',
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
          `Find likely contact names for target companies: ${input.findContacts ? 'yes' : 'no'}`,
          '',
          'User-supplied source/research text:',
          input.sourceText || 'No user-supplied source text.',
          '',
          'Logged live web-search snippets:',
          sourcesToText(researchSources) || 'No live web research sources were collected.',
          '',
          'For each candidate, cite sourceUrl/sourceLabel when available. If contact discovery is enabled, include likely owners/directors/founders/CEOs only when evidence supports the name and role. Stage uncertain people as low-confidence CONTACT candidates.'
        ].join('\n')
      });
      modelOutput = modelResult.structured;
    } catch (error) {
      modelOutput = { candidates: fallbackCandidates(input), runBriefing: { summary: error instanceof Error ? error.message : String(error) } };
    }

    const rawCandidates = Array.isArray(modelOutput?.candidates) ? modelOutput!.candidates : fallbackCandidates(input);
    const max = Math.max(1, Math.min(25, Number(input.maxCandidates || 5)));
    const candidates = rawCandidates.map(normaliseCandidate).filter(Boolean).slice(0, max) as OutreachCandidateOutput[];
    await completeAgentStep(modelStep.id, { candidateCount: candidates.length, researchSourceCount: researchSources.length });

    const stageStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'stage_candidates',
      stepName: 'Stage candidates, scores, approvals, drafts, sources, and tasks',
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
        notes: candidate.notes || candidate.outreachAngle || candidate.contactResearchReason,
        structuredJson: { ...candidate, stage: 3 }
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

      const candidateSources = researchSources.filter((source) => {
        const haystack = `${source.title || ''} ${source.url || ''} ${source.snippet || ''}`.toLowerCase();
        return haystack.includes(candidate.name.toLowerCase()) || (candidate.companyName && haystack.includes(candidate.companyName.toLowerCase()));
      }).slice(0, 5);

      for (const source of candidateSources) {
        await executeAgentTool<any, any>('create_research_source', {
          sourceType: 'SEARCH_RESULT',
          provider: source.provider,
          query: source.query,
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          researchCandidateId: staged.id,
          evidenceJson: { ...source, linkedBy: 'candidate_name_match' },
          confidence: candidate.confidence || 50
        }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });
      }

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
          outreachAngle: candidate.outreachAngle || '',
          roleTitle: candidate.roleTitle || '',
          companyName: candidate.companyName || '',
          sourceEvidence: candidate.sourceEvidence || []
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

      created.push({ candidateId: staged.id, scoreId: score.id, draftArtifactId: draft.id, approvalId: approval.id, sourceCount: candidateSources.length });
    }

    if (created.length) {
      await executeAgentTool<any, any>('create_task', {
        title: `Review ${created.length} outreach candidate${created.length === 1 ? '' : 's'} for ${input.sector}`,
        notes: `Outreach Agent staged ${created.length} candidate${created.length === 1 ? '' : 's'} using ${researchSources.length} logged research source${researchSources.length === 1 ? '' : 's'}. Review the candidates and approve, reject, or import them before outreach.`,
        urgency: 'HIGH',
        importance: 'HIGH',
        taskType: 'REVIEW',
        projectId: input.projectId,
        dealId: input.dealId,
        sourceType: 'agent_run',
        sourceId: run.id
      }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });
    }

    await completeAgentStep(stageStep.id, { created, researchSourceCount: researchSources.length });

    const brief = modelOutput?.runBriefing || {};
    const briefingTitle = cleanText(brief.title, `Outreach research briefing: ${input.sector}`) || `Outreach research briefing: ${input.sector}`;
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
      `- Live web research: ${input.enableWebResearch ? 'Yes' : 'No'}`,
      `- Contact discovery: ${input.findContacts ? 'Yes' : 'No'}`,
      '',
      '## Research sources logged',
      ...(researchSources.length ? researchSources.slice(0, 20).map((s) => `- ${s.title || s.url || 'Source'}${s.url ? ` - ${s.url}` : ''}`) : ['- No live research sources logged.']),
      '',
      '## Candidates staged',
      ...candidates.map((c) => `- ${c.name} (${c.entityType || 'COMPANY'}) - score ${c.totalScore ?? 0}/100 - ${c.outreachAngle || 'Review needed'}`),
      '',
      '## Recommended next actions',
      ...(nextActions.length ? nextActions.map((a) => `- ${a}`) : ['- Review candidate approvals.', '- Import approved candidates into CRM.', '- Edit drafts before sending any outreach.'])
    ].join('\n');

    await executeAgentTool<any, any>('create_agent_artifact', {
      artifactType: 'outreach_research_briefing',
      title: briefingTitle,
      content: briefingContent,
      summary: briefingSummary,
      structuredJson: { input, candidates, created, sourceCount: researchSources.length, runBriefing: brief },
      entityType: input.projectId ? 'project' : input.dealId ? 'deal' : undefined,
      entityId: input.projectId || input.dealId || undefined
    }, { userId: input.userId, agentRunId: run.id, agentStepId: stageStep.id, agentDefinitionId: agent.id });

    await completeAgentRun(run.id, { candidateCount: created.length, researchSourceCount: researchSources.length, candidates: created });
    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  } catch (error) {
    const runningStep = await prisma.agentStep.findFirst({ where: { agentRunId: run.id, status: 'running' }, orderBy: { createdAt: 'desc' } });
    if (runningStep) await failAgentStep(runningStep.id, error);
    await failAgentRun(run.id, error);
    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  }
}

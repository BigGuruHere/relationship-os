// src/lib/server/agents/agents/contactEnrichmentAgent.ts
// PURPOSE: Stage public contact-detail enrichments with evidence. Does not update CRM truth automatically.

import { prisma } from '$lib/db';
import { executeAgentTool } from '$lib/server/agents/toolRegistry';
import { generateStructured } from '$lib/server/agents/modelGateway';
import { createAgentStep, completeAgentStep, failAgentStep } from '$lib/server/agents/agentLogger';
import { completeAgentRun, failAgentRun, startAgentRun } from '$lib/server/agents/runtime';
import type { AgentEntityType, ContactEnrichmentAgentOutput, ContactEnrichmentOutput } from '$lib/server/agents/types';

type RunContactEnrichmentInput = {
  userId: string;
  entityType?: AgentEntityType | 'research_candidate';
  entityId?: string;
  targetName?: string;
  companyName?: string;
  sourceText?: string;
  enrichmentGoal?: string;
  enableWebResearch?: boolean;
  researchProvider?: string;
  maxResults?: number;
};

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['enrichments', 'runBriefing'],
  properties: {
    enrichments: { type: 'array' },
    runBriefing: { type: 'object' }
  }
};

function clean(value: unknown, fallback = '') {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function cleanMultiline(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function clamp(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normaliseEnrichment(raw: ContactEnrichmentOutput): ContactEnrichmentOutput | null {
  const hasDetail = [raw.fullName, raw.email, raw.phone, raw.linkedin, raw.companyName, raw.roleTitle, raw.website].some((v) => clean(v));
  if (!hasDetail) return null;

  return {
    targetName: clean(raw.targetName),
    fullName: clean(raw.fullName),
    email: clean(raw.email),
    phone: clean(raw.phone),
    linkedin: clean(raw.linkedin),
    companyName: clean(raw.companyName),
    roleTitle: clean(raw.roleTitle),
    website: clean(raw.website),
    sourceUrl: clean(raw.sourceUrl),
    sourceLabel: clean(raw.sourceLabel),
    confidence: clamp(raw.confidence, 50),
    evidence: cleanMultiline(raw.evidence),
    notes: cleanMultiline(raw.notes),
    recommendedAction: cleanMultiline(raw.recommendedAction)
  };
}

function buildSearchQueries(input: RunContactEnrichmentInput, entityText: string) {
  const target = clean(input.targetName);
  const company = clean(input.companyName);
  const base = [target, company].filter(Boolean).join(' ');
  const context = clean(entityText).slice(0, 180);

  const queries = [
    `${base || context} email phone LinkedIn`,
    `${base || context} principal broker founder director contact`,
    `${base || context} site:linkedin.com/in OR team OR about OR contact`
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

function enrichmentMarkdown(enrichments: ContactEnrichmentOutput[], briefing: any) {
  const lines = [
    `# ${briefing?.title || 'Contact enrichment results'}`,
    '',
    briefing?.summary || 'Review staged enrichment details before applying to CRM.',
    '',
    '## Proposed enrichments'
  ];

  enrichments.forEach((item, index) => {
    lines.push('', `### ${index + 1}. ${item.targetName || item.fullName || item.companyName || 'Proposed contact detail'}`);
    if (item.fullName) lines.push(`- Name: ${item.fullName}`);
    if (item.roleTitle) lines.push(`- Role/title: ${item.roleTitle}`);
    if (item.companyName) lines.push(`- Company: ${item.companyName}`);
    if (item.email) lines.push(`- Email: ${item.email}`);
    if (item.phone) lines.push(`- Phone: ${item.phone}`);
    if (item.linkedin) lines.push(`- LinkedIn: ${item.linkedin}`);
    if (item.website) lines.push(`- Website: ${item.website}`);
    lines.push(`- Confidence: ${item.confidence ?? 50}/100`);
    if (item.sourceUrl) lines.push(`- Source: ${item.sourceLabel || item.sourceUrl} - ${item.sourceUrl}`);
    if (item.evidence) lines.push(`- Evidence: ${item.evidence}`);
    if (item.notes) lines.push(`- Notes: ${item.notes}`);
    if (item.recommendedAction) lines.push(`- Recommended action: ${item.recommendedAction}`);
  });

  if (Array.isArray(briefing?.recommendedNextActions) && briefing.recommendedNextActions.length) {
    lines.push('', '## Recommended next actions');
    briefing.recommendedNextActions.forEach((action: string) => lines.push(`- ${action}`));
  }

  return lines.join('\n').trim();
}

export async function runContactEnrichmentAgent(input: RunContactEnrichmentInput) {
  const { agent, activePrompt, run } = await startAgentRun({
    userId: input.userId,
    agentKey: 'contact_enrichment_agent',
    triggerType: 'manual',
    triggerEntityType: input.entityType,
    triggerEntityId: input.entityId,
    inputJson: {
      entityType: input.entityType,
      entityId: input.entityId,
      targetName: input.targetName,
      companyName: input.companyName,
      sourceTextChars: input.sourceText?.length ?? 0,
      enableWebResearch: input.enableWebResearch ?? false,
      researchProvider: input.researchProvider || 'auto'
    }
  });

  try {
    let entityContext: any = null;
    let entityText = '';
    let linkedCompanyId = input.entityType === 'company' ? input.entityId : undefined;
    let linkedContactId = input.entityType === 'contact' ? input.entityId : undefined;
    let linkedCandidateId = input.entityType === 'research_candidate' ? input.entityId : undefined;

    if (input.entityType && input.entityId) {
      const readStep = await createAgentStep({ agentRunId: run.id, stepKey: 'read_enrichment_target', stepName: 'Read enrichment target context', inputJson: { entityType: input.entityType, entityId: input.entityId } });
      try {
        entityContext = await executeAgentTool<any, any>('read_entity_context', { entityType: input.entityType, entityId: input.entityId }, { userId: input.userId, agentRunId: run.id, agentStepId: readStep.id, agentDefinitionId: agent.id });
        entityText = JSON.stringify(entityContext, null, 2).slice(0, 5000);
        await completeAgentStep(readStep.id, { hasEntityContext: true });
      } catch (error) {
        await failAgentStep(readStep.id, error);
      }
    }

    const researchSources: any[] = [];
    if (input.enableWebResearch) {
      const queries = buildSearchQueries(input, entityText || input.sourceText || '');
      const researchStep = await createAgentStep({ agentRunId: run.id, stepKey: 'enrichment_web_research', stepName: 'Search public contact-detail sources', inputJson: { queries, provider: input.researchProvider || 'auto' } });
      try {
        for (const query of queries) {
          const search = await executeAgentTool<any, any>('research_web_search', {
            query,
            maxResults: Math.max(3, Math.min(10, Number(input.maxResults || 5))),
            provider: input.researchProvider || undefined,
            purpose: 'contact_enrichment'
          }, { userId: input.userId, agentRunId: run.id, agentStepId: researchStep.id, agentDefinitionId: agent.id });

          for (const result of search.results || []) {
            researchSources.push({ ...result, query, provider: search.provider });
            await executeAgentTool<any, any>('create_research_source', {
              sourceType: 'SEARCH_RESULT',
              provider: search.provider,
              query,
              title: result.title,
              url: result.url,
              snippet: result.snippet,
              confidence: 55,
              companyId: linkedCompanyId,
              contactId: linkedContactId,
              researchCandidateId: linkedCandidateId,
              evidenceJson: { purpose: 'contact_enrichment' }
            }, { userId: input.userId, agentRunId: run.id, agentStepId: researchStep.id, agentDefinitionId: agent.id });
          }
        }
        await completeAgentStep(researchStep.id, { sourceCount: researchSources.length });
      } catch (error) {
        await failAgentStep(researchStep.id, error);
      }
    }

    const modelStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'generate_contact_enrichments',
      stepName: 'Generate staged contact enrichments',
      inputJson: { hasEntityContext: Boolean(entityContext), sourceCount: researchSources.length }
    });

    const userPrompt = [
      'Contact enrichment request:',
      `Target name: ${input.targetName || ''}`,
      `Company name: ${input.companyName || ''}`,
      `Goal: ${input.enrichmentGoal || 'Find public contact details, role/title, LinkedIn, email, phone, and website where supported by evidence.'}`,
      '',
      'Entity context:',
      entityText || 'No entity context supplied.',
      '',
      'User-supplied source text:',
      input.sourceText || 'No user-supplied source text.',
      '',
      'Logged web/search snippets:',
      sourcesToText(researchSources) || 'No logged web-search snippets.',
      '',
      'Rules:',
      '- Only include a detail if the supplied context/source evidence supports it.',
      '- Do not guess private contact details.',
      '- If an email format is inferred rather than directly shown, write that in notes and set confidence below 45.',
      '- Prefer one high-quality enrichment over many weak ones.'
    ].join('\n');

    const model = await generateStructured<ContactEnrichmentAgentOutput>({
      userId: input.userId,
      agentRunId: run.id,
      agentStepId: modelStep.id,
      provider: agent.defaultModelProvider,
      model: agent.defaultModelName,
      purpose: 'contact_enrichment',
      systemPrompt: activePrompt?.systemPrompt || agent.systemPrompt,
      userPrompt,
      outputSchema: activePrompt?.outputSchemaJson || OUTPUT_SCHEMA
    });

    const raw = model.structured?.enrichments || [];
    const enrichments = raw.map(normaliseEnrichment).filter(Boolean) as ContactEnrichmentOutput[];
    await completeAgentStep(modelStep.id, { enrichmentCount: enrichments.length });

    const storeStep = await createAgentStep({ agentRunId: run.id, stepKey: 'store_contact_enrichments', stepName: 'Store staged enrichments and review artifact', inputJson: { enrichmentCount: enrichments.length } });
    for (const enrichment of enrichments) {
      await executeAgentTool<any, any>('create_contact_enrichment', {
        ...enrichment,
        companyId: linkedCompanyId,
        contactId: linkedContactId,
        researchCandidateId: linkedCandidateId,
        structuredJson: enrichment
      }, { userId: input.userId, agentRunId: run.id, agentStepId: storeStep.id, agentDefinitionId: agent.id });
    }

    const briefing = model.structured?.runBriefing || {
      title: `Contact enrichment: ${input.targetName || input.companyName || input.entityType || 'target'}`,
      summary: `${enrichments.length} proposed enrichment record(s) staged for review.`,
      recommendedNextActions: ['Review evidence before applying details to CRM.']
    };

    await executeAgentTool<any, any>('create_agent_artifact', {
      artifactType: 'contact_enrichment_report',
      title: briefing.title || 'Contact enrichment report',
      summary: briefing.summary || `${enrichments.length} proposed enrichment record(s) staged.`,
      content: enrichmentMarkdown(enrichments, briefing),
      structuredJson: { enrichments, runBriefing: briefing },
      entityType: input.entityType || undefined,
      entityId: input.entityId || undefined
    }, { userId: input.userId, agentRunId: run.id, agentStepId: storeStep.id, agentDefinitionId: agent.id });

    if (enrichments.length) {
      await executeAgentTool<any, any>('create_task', {
        title: `Review contact enrichment: ${input.targetName || input.companyName || enrichments[0]?.targetName || 'target'}`,
        notes: 'Review staged contact enrichment details and apply only evidence-backed fields to CRM.',
        contactId: linkedContactId,
        companyId: linkedCompanyId,
        sourceType: 'agent_contact_enrichment',
        sourceId: run.id,
        taskType: 'REVIEW',
        urgency: 'MEDIUM',
        importance: 'MEDIUM'
      }, { userId: input.userId, agentRunId: run.id, agentStepId: storeStep.id, agentDefinitionId: agent.id });
    }

    await completeAgentStep(storeStep.id, { enrichmentCount: enrichments.length });
    await completeAgentRun(run.id, { enrichmentCount: enrichments.length });
    return await prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  } catch (error) {
    await failAgentRun(run.id, error);
    throw error;
  }
}

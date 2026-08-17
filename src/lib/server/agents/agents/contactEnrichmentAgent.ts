// src/lib/server/agents/agents/contactEnrichmentAgent.ts
// PURPOSE: Stage evidence-backed enrichment fields. Does not update CRM truth automatically.

import { prisma } from '$lib/db';
import { executeAgentTool } from '$lib/server/agents/toolRegistry';
import { generateStructured } from '$lib/server/agents/modelGateway';
import { createAgentStep, completeAgentStep, failAgentStep } from '$lib/server/agents/agentLogger';
import { completeAgentRun, failAgentRun, startAgentRun } from '$lib/server/agents/runtime';
import type { AgentEntityType, ContactEnrichmentAgentOutput, ContactEnrichmentOutput } from '$lib/server/agents/types';

type EnrichmentMode = 'contact' | 'company' | 'find_contacts';

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
  mode?: EnrichmentMode;
};

type ProposedRow = ContactEnrichmentOutput & {
  fieldKey: string;
  fieldLabel: string;
  proposedValue: string;
  existingValue?: string;
  evidenceType?: string;
  sourceKind?: string;
  conflictStatus?: string;
  isApplyable?: boolean;
  groupKey?: string;
};

const OUTPUT_SCHEMA = {
  type: 'object',
  required: ['enrichments', 'runBriefing'],
  properties: {
    enrichments: { type: 'array' },
    runBriefing: { type: 'object' }
  }
};

const FIELD_LABELS: Record<string, string> = {
  'contact.fullName': 'Contact name',
  'contact.email': 'Email',
  'contact.phone': 'Phone',
  'contact.linkedin': 'LinkedIn',
  'contact.company': 'Contact company',
  'contact.position': 'Role/title',
  'company.name': 'Company name',
  'company.website': 'Website',
  'company.phone': 'Company phone',
  'company.industry': 'Industry',
  'company.location': 'Location',
  'company.description': 'Description',
  'company.criteria': 'Criteria',
  'company.notes': 'Company note'
};

const APPLYABLE_FIELD_KEYS = new Set(Object.keys(FIELD_LABELS));

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

function slug(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'enrichment';
}

function norm(value: unknown) {
  return clean(value).toLowerCase();
}

function normLoose(value: unknown) {
  return norm(value).replace(/[^a-z0-9@.]+/g, '');
}

function normPhone(value: unknown) {
  return clean(value).replace(/\D+/g, '');
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isLikelyInferred(row: any) {
  const text = `${row.evidence || ''} ${row.notes || ''} ${row.sourceLabel || ''}`.toLowerCase();
  return /infer|guessed|guess|format|pattern|not directly verified|not verified|unverified/.test(text);
}

function isSensitiveGuessedField(fieldKey: string) {
  return ['contact.email', 'contact.phone', 'contact.linkedin'].includes(fieldKey);
}

function valueAppearsInText(fieldKey: string, value: string, text: string) {
  if (!value || !text) return false;
  const lowerText = text.toLowerCase();
  const lowerValue = value.toLowerCase();
  if (lowerText.includes(lowerValue)) return true;

  if (fieldKey.includes('phone')) {
    const phone = normPhone(value);
    const phoneText = normPhone(text);
    return phone.length >= 8 && phoneText.includes(phone);
  }

  if (fieldKey.includes('website') || fieldKey.includes('linkedin')) {
    return normLoose(text).includes(normLoose(value));
  }

  return false;
}

function sourceUrlSupported(sourceUrl: string, researchSources: any[]) {
  const url = norm(sourceUrl);
  if (!isUrl(sourceUrl)) return false;
  return researchSources.some((source) => {
    const sourceUrlNorm = norm(source.url);
    return sourceUrlNorm && (sourceUrlNorm === url || url.includes(sourceUrlNorm) || sourceUrlNorm.includes(url));
  });
}

function existingMapFromContext(entityContext: any) {
  const map: Record<string, string> = {};
  if (!entityContext) return map;

  if (entityContext.entityType === 'contact') {
    map['contact.fullName'] = clean(entityContext.name);
    map['contact.email'] = clean(entityContext.email);
    map['contact.phone'] = clean(entityContext.phone);
    map['contact.linkedin'] = clean(entityContext.linkedin);
    map['contact.company'] = clean(entityContext.company || entityContext.companies?.[0]?.name);
    map['contact.position'] = clean(entityContext.position || entityContext.companies?.[0]?.title);
  }

  if (entityContext.entityType === 'company') {
    map['company.name'] = clean(entityContext.name);
    map['company.website'] = clean(entityContext.website);
    map['company.phone'] = clean(entityContext.phone);
    map['company.industry'] = clean(entityContext.industry);
    map['company.location'] = clean(entityContext.location);
    map['company.description'] = clean(entityContext.description);
    map['company.criteria'] = clean(entityContext.criteria);
    map['company.notes'] = clean(entityContext.notes);
  }

  return map;
}

function inferFieldKey(raw: any, key: string, mode: EnrichmentMode) {
  if (raw.fieldKey) return clean(raw.fieldKey);
  if (key === 'fullName') return 'contact.fullName';
  if (key === 'email') return 'contact.email';
  if (key === 'phone') return mode === 'company' ? 'company.phone' : 'contact.phone';
  if (key === 'linkedin') return 'contact.linkedin';
  if (key === 'roleTitle') return 'contact.position';
  if (key === 'companyName') return mode === 'company' ? 'company.name' : 'contact.company';
  if (key === 'website') return mode === 'company' ? 'company.website' : 'company.website';
  return '';
}

function rowFromLegacy(raw: any, key: string, value: string, mode: EnrichmentMode, groupKey: string): ProposedRow | null {
  const fieldKey = inferFieldKey(raw, key, mode);
  if (!fieldKey || !APPLYABLE_FIELD_KEYS.has(fieldKey)) return null;
  return {
    targetName: clean(raw.targetName || raw.fullName || raw.companyName),
    fullName: clean(raw.fullName),
    companyName: clean(raw.companyName),
    fieldKey,
    fieldLabel: FIELD_LABELS[fieldKey] || fieldKey,
    proposedValue: value,
    sourceUrl: clean(raw.sourceUrl),
    sourceLabel: clean(raw.sourceLabel),
    confidence: clamp(raw.confidence, 50),
    evidence: cleanMultiline(raw.evidence),
    notes: cleanMultiline(raw.notes),
    recommendedAction: cleanMultiline(raw.recommendedAction),
    groupKey
  };
}

function explodeRawEnrichment(raw: any, mode: EnrichmentMode, fallbackTargetName: string, fallbackCompanyName: string) {
  const targetName = clean(raw.targetName || raw.fullName || fallbackTargetName || raw.companyName || fallbackCompanyName);
  const companyName = clean(raw.companyName || fallbackCompanyName);
  const groupKey = clean(raw.groupKey) || slug(`${targetName}|${companyName}`);

  if (raw.fieldKey && raw.proposedValue) {
    const fieldKey = clean(raw.fieldKey);
    if (!APPLYABLE_FIELD_KEYS.has(fieldKey)) return [];
    return [{
      targetName,
      fullName: clean(raw.fullName || (fieldKey.startsWith('contact.') ? targetName : '')),
      companyName,
      fieldKey,
      fieldLabel: clean(raw.fieldLabel || FIELD_LABELS[fieldKey] || fieldKey),
      proposedValue: clean(raw.proposedValue),
      existingValue: clean(raw.existingValue),
      evidenceType: clean(raw.evidenceType),
      sourceKind: clean(raw.sourceKind),
      conflictStatus: clean(raw.conflictStatus),
      isApplyable: raw.isApplyable !== false,
      sourceUrl: clean(raw.sourceUrl),
      sourceLabel: clean(raw.sourceLabel),
      confidence: clamp(raw.confidence, 50),
      evidence: cleanMultiline(raw.evidence),
      notes: cleanMultiline(raw.notes),
      recommendedAction: cleanMultiline(raw.recommendedAction),
      groupKey
    } satisfies ProposedRow];
  }

  const fields = ['fullName', 'email', 'phone', 'linkedin', 'companyName', 'roleTitle', 'website'];
  return fields
    .map((key) => {
      const value = clean(raw[key]);
      if (!value) return null;
      return rowFromLegacy(raw, key, value, mode, groupKey);
    })
    .filter(Boolean) as ProposedRow[];
}

function supportAndClassify(row: ProposedRow, args: { entityText: string; sourceText: string; researchText: string; researchSources: any[]; existingValues: Record<string, string> }) {
  const value = clean(row.proposedValue);
  const existingValue = clean(row.existingValue || args.existingValues[row.fieldKey]);
  const sourceUrl = clean(row.sourceUrl);
  const evidenceText = `${row.evidence || ''}\n${row.notes || ''}`;
  const allUserEvidence = `${args.sourceText}\n${args.researchText}\n${evidenceText}`;

  if (!value || !APPLYABLE_FIELD_KEYS.has(row.fieldKey)) return null;

  const sameAsExisting = existingValue && normLoose(existingValue) === normLoose(value);
  if (sameAsExisting) {
    return {
      ...row,
      existingValue,
      evidenceType: 'EXISTING_CRM',
      sourceKind: 'CRM',
      conflictStatus: 'VERIFIED_EXISTING',
      isApplyable: false,
      confidence: Math.max(clamp(row.confidence, 50), 70),
      notes: row.notes || 'This value already exists in CRM. No update is needed.'
    };
  }

  const inSourceText = valueAppearsInText(row.fieldKey, value, args.sourceText);
  const inResearchText = valueAppearsInText(row.fieldKey, value, args.researchText);
  const inEntityContext = valueAppearsInText(row.fieldKey, value, args.entityText);
  const urlSupported = sourceUrlSupported(sourceUrl, args.researchSources);
  const inferred = isLikelyInferred(row);

  let evidenceType = '';
  let sourceKind = '';
  if (inSourceText) { evidenceType = 'USER_SOURCE'; sourceKind = 'USER_SOURCE_TEXT'; }
  else if (inResearchText || urlSupported) { evidenceType = 'WEB_SOURCE'; sourceKind = 'LOGGED_WEB_SEARCH'; }
  else if (inEntityContext) { evidenceType = 'CRM_NOTE'; sourceKind = 'CRM_CONTEXT'; }

  if (!evidenceType) {
    return null;
  }

  const conflictStatus = existingValue ? 'CONFLICT' : 'NEW';
  const sensitiveGuess = isSensitiveGuessedField(row.fieldKey) && inferred && !inSourceText && !inResearchText && !inEntityContext;
  const isApplyable = !sensitiveGuess;

  return {
    ...row,
    existingValue,
    evidenceType,
    sourceKind,
    conflictStatus,
    isApplyable,
    confidence: sensitiveGuess ? Math.min(clamp(row.confidence, 35), 40) : clamp(row.confidence, evidenceType === 'WEB_SOURCE' ? 60 : 50),
    notes: sensitiveGuess
      ? `${row.notes || ''}\nInferred-only contact details are not applyable. Verify manually before adding to CRM.`.trim()
      : row.notes
  };
}

function buildSearchQueries(input: RunContactEnrichmentInput, entityText: string) {
  const target = clean(input.targetName);
  const company = clean(input.companyName);
  const base = [target, company].filter(Boolean).join(' ');
  const context = clean(entityText).slice(0, 180);
  const mode = input.mode || (input.entityType === 'company' ? 'company' : 'contact');

  const companyQueries = [
    `${base || context} official website contact about services location`,
    `${base || context} ABN ACN LinkedIn company phone email`,
    `${base || context} team principal founder director mortgage broker`
  ];

  const contactQueries = [
    `${base || context} email phone LinkedIn`,
    `${base || context} principal broker founder director contact`,
    `${base || context} site:linkedin.com/in OR team OR about OR contact`
  ];

  const queries = mode === 'company' ? companyQueries : contactQueries;
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

function enrichmentMarkdown(enrichments: ProposedRow[], briefing: any, mode: EnrichmentMode) {
  const lines = [
    `# ${briefing?.title || 'Enrichment results'}`,
    '',
    briefing?.summary || 'Review staged enrichment fields before applying to CRM.',
    '',
    '## Proposed enrichments'
  ];

  if (!enrichments.length) {
    lines.push('', 'No supported enrichment fields were found.', '', 'Add source text, enable live web research, or verify manually before applying new data to CRM.');
  }

  enrichments.forEach((item, index) => {
    lines.push('', `### ${index + 1}. ${item.fieldLabel || item.fieldKey}`);
    lines.push(`- Target: ${item.targetName || item.fullName || item.companyName || 'Target'}`);
    lines.push(`- Field: ${item.fieldLabel || item.fieldKey}`);
    lines.push(`- Proposed value: ${item.proposedValue}`);
    if (item.existingValue) lines.push(`- Existing value: ${item.existingValue}`);
    lines.push(`- Status: ${item.conflictStatus || 'NEW'}`);
    lines.push(`- Evidence type: ${item.evidenceType || 'UNKNOWN'}`);
    lines.push(`- Applyable: ${item.isApplyable === false ? 'No' : 'Yes'}`);
    lines.push(`- Confidence: ${item.confidence ?? 50}/100`);
    if (item.sourceUrl) lines.push(`- Source: ${item.sourceLabel || item.sourceUrl} - ${item.sourceUrl}`);
    if (item.evidence) lines.push(`- Evidence: ${item.evidence}`);
    if (item.notes) lines.push(`- Notes: ${item.notes}`);
    if (item.recommendedAction) lines.push(`- Recommended action: ${item.recommendedAction}`);
  });

  if (Array.isArray(briefing?.recommendedNextActions) && briefing.recommendedNextActions.length) {
    lines.push('', '## Recommended next actions');
    briefing.recommendedNextActions.forEach((action: string) => lines.push(`- ${action}`));
  } else if (!enrichments.length) {
    lines.push('', '## Recommended next actions');
    lines.push(mode === 'find_contacts' ? '- Do not stage or import contacts without source evidence for their name and role.' : '- Add stronger evidence or verify manually before applying CRM changes.');
  }

  return lines.join('\n').trim();
}

function modeInstruction(mode: EnrichmentMode) {
  if (mode === 'company') {
    return 'Mode: company enrichment. Propose field-level updates for company.website, company.industry, company.location, company.description, company.criteria, or company.notes. Do not invent employees. Do not propose contacts in this mode.';
  }
  if (mode === 'find_contacts') {
    return 'Mode: company contact discovery. Only propose contact.fullName, contact.position, contact.email, contact.phone, contact.linkedin, or contact.company for people whose name and relationship to the company are explicitly supported by evidence. If no supported person is found, return an empty enrichments array.';
  }
  return 'Mode: contact enrichment. Propose field-level updates for contact.fullName, contact.email, contact.phone, contact.linkedin, contact.company, or contact.position.';
}

export async function runContactEnrichmentAgent(input: RunContactEnrichmentInput) {
  const mode: EnrichmentMode = input.mode || (input.entityType === 'company' ? 'company' : 'contact');
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
      researchProvider: input.researchProvider || 'auto',
      mode
    }
  });

  try {
    let entityContext: any = null;
    let entityText = '';
    const linkedCompanyId = input.entityType === 'company' ? input.entityId : undefined;
    const linkedContactId = input.entityType === 'contact' ? input.entityId : undefined;
    const linkedCandidateId = input.entityType === 'research_candidate' ? input.entityId : undefined;

    if (input.entityType && input.entityId) {
      const readStep = await createAgentStep({ agentRunId: run.id, stepKey: 'read_enrichment_target', stepName: 'Read enrichment target context', inputJson: { entityType: input.entityType, entityId: input.entityId } });
      try {
        entityContext = await executeAgentTool<any, any>('read_entity_context', { entityType: input.entityType, entityId: input.entityId }, { userId: input.userId, agentRunId: run.id, agentStepId: readStep.id, agentDefinitionId: agent.id });
        entityText = JSON.stringify(entityContext, null, 2).slice(0, 8000);
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
              evidenceJson: { purpose: 'contact_enrichment', mode }
            }, { userId: input.userId, agentRunId: run.id, agentStepId: researchStep.id, agentDefinitionId: agent.id });
          }
        }
        await completeAgentStep(researchStep.id, { sourceCount: researchSources.length });
      } catch (error) {
        await failAgentStep(researchStep.id, error);
      }
    }

    const noEvidenceAtAll = !entityText && !clean(input.sourceText) && researchSources.length === 0;
    const modelStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'generate_contact_enrichments',
      stepName: 'Generate staged enrichment fields',
      inputJson: { hasEntityContext: Boolean(entityContext), sourceCount: researchSources.length, mode, skippedForNoEvidence: noEvidenceAtAll }
    });

    let structured: ContactEnrichmentAgentOutput = {
      enrichments: [],
      runBriefing: {
        title: `Enrichment: ${input.targetName || input.companyName || entityContext?.name || 'target'}`,
        summary: 'No supported enrichment found. Add source text, enable web research, or verify manually before applying CRM changes.',
        recommendedNextActions: ['Do not apply guessed or unsupported contact details to CRM.']
      }
    };

    if (!noEvidenceAtAll) {
      const userPrompt = [
        'Data enrichment request:',
        modeInstruction(mode),
        `Target name: ${input.targetName || ''}`,
        `Company name: ${input.companyName || ''}`,
        `Goal: ${input.enrichmentGoal || 'Find evidence-backed CRM enrichment fields. Stage proposals for human review only.'}`,
        '',
        'Allowed field keys:',
        Object.keys(FIELD_LABELS).join(', '),
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
        '- Return field-level enrichments, not one package containing many fields.',
        '- Each enrichment must include fieldKey, fieldLabel, proposedValue, evidenceType, sourceKind, conflictStatus, confidence, evidence, and recommendedAction.',
        '- Only include a value when the value is explicitly present in entity context, user-supplied source text, or logged search snippets.',
        '- Do not invent people. For contact discovery, never create a person unless the name and role/company relationship are evidence-backed.',
        '- Do not create applyable rows for guessed email formats, guessed phone numbers, or inferred LinkedIn URLs.',
        '- Use conflictStatus NEW, VERIFIED_EXISTING, CONFLICT, or INFERRED_ONLY.',
        '- If no supported fields are found, return an empty enrichments array and explain what evidence is missing.'
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
      structured = model.structured || structured;
    }

    const raw = structured?.enrichments || [];
    const exploded = raw.flatMap((item: any) => explodeRawEnrichment(item, mode, clean(input.targetName || entityContext?.name), clean(input.companyName || entityContext?.company || entityContext?.name)));
    const researchText = sourcesToText(researchSources);
    const existingValues = existingMapFromContext(entityContext);
    const enrichments = exploded
      .map((row) => supportAndClassify(row, { entityText, sourceText: input.sourceText || '', researchText, researchSources, existingValues }))
      .filter(Boolean) as ProposedRow[];

    await completeAgentStep(modelStep.id, { enrichmentCount: enrichments.length, rawEnrichmentCount: raw.length, rejectedUnsupportedCount: exploded.length - enrichments.length });

    const storeStep = await createAgentStep({ agentRunId: run.id, stepKey: 'store_contact_enrichments', stepName: 'Store staged enrichment fields and review artifact', inputJson: { enrichmentCount: enrichments.length, mode } });
    for (const enrichment of enrichments) {
      await executeAgentTool<any, any>('create_contact_enrichment', {
        ...enrichment,
        companyId: linkedCompanyId,
        contactId: linkedContactId,
        researchCandidateId: linkedCandidateId,
        structuredJson: enrichment
      }, { userId: input.userId, agentRunId: run.id, agentStepId: storeStep.id, agentDefinitionId: agent.id });
    }

    const fallbackBriefing = {
      title: `${mode === 'company' ? 'Company' : mode === 'find_contacts' ? 'Contact discovery' : 'Contact'} enrichment: ${input.targetName || input.companyName || entityContext?.name || 'target'}`,
      summary: enrichments.length
        ? `${enrichments.length} evidence-backed enrichment field(s) staged for review.`
        : 'No supported enrichment found. The agent did not stage unsupported or inferred details.',
      recommendedNextActions: enrichments.length
        ? ['Review each field independently. Apply only evidence-backed fields to CRM.']
        : [mode === 'find_contacts' ? 'No supported contact names found. Add source text or enable working web research before importing people.' : 'Add stronger source evidence or verify manually before applying CRM changes.']
    };
    const briefing = { ...fallbackBriefing, ...(structured?.runBriefing || {}) };
    if (!enrichments.length) briefing.summary = fallbackBriefing.summary;

    await executeAgentTool<any, any>('create_agent_artifact', {
      artifactType: 'contact_enrichment_report',
      title: briefing.title || 'Enrichment report',
      summary: briefing.summary || `${enrichments.length} proposed enrichment field(s) staged.`,
      content: enrichmentMarkdown(enrichments, briefing, mode),
      structuredJson: { enrichments, runBriefing: briefing, mode },
      entityType: input.entityType || undefined,
      entityId: input.entityId || undefined
    }, { userId: input.userId, agentRunId: run.id, agentStepId: storeStep.id, agentDefinitionId: agent.id });

    if (enrichments.some((item) => item.isApplyable !== false)) {
      await executeAgentTool<any, any>('create_task', {
        title: `Review enrichment: ${input.targetName || input.companyName || entityContext?.name || enrichments[0]?.targetName || 'target'}`,
        notes: 'Review staged enrichment fields independently and apply only evidence-backed fields to CRM.',
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
    await completeAgentRun(run.id, { enrichmentCount: enrichments.length, mode });
    return await prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  } catch (error) {
    await failAgentRun(run.id, error);
    throw error;
  }
}

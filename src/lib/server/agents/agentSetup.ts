// src/lib/server/agents/agentSetup.ts
// PURPOSE: Create core agent definitions and tool permissions if missing.

import { prisma } from '$lib/db';

const BROKER_BRIEF_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['title', 'summary', 'context', 'keyPeople', 'openTasks', 'risks', 'opportunities', 'recommendedNextActions'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    context: { type: 'array', items: { type: 'string' } },
    keyPeople: { type: 'array', items: { type: 'string' } },
    openTasks: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    opportunities: { type: 'array', items: { type: 'string' } },
    recommendedNextActions: { type: 'array', items: { type: 'string' } }
  }
};

const OUTREACH_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['candidates', 'runBriefing'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['entityType', 'name', 'confidence', 'totalScore', 'outreachAngle'],
        properties: {
          entityType: { type: 'string', enum: ['COMPANY', 'CONTACT'] },
          name: { type: 'string' },
          website: { type: 'string' },
          sourceUrl: { type: 'string' },
          sourceLabel: { type: 'string' },
          confidence: { type: 'number' },
          notes: { type: 'string' },
          totalScore: { type: 'number' },
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
          scoreLabel: { type: 'string' },
          priority: { type: 'string' },
          recommendedAction: { type: 'string' },
          scoreFactors: { type: 'array', items: { type: 'object' } },
          scoreRationale: { type: 'array', items: { type: 'string' } },
          outreachAngle: { type: 'string' },
          draftSubject: { type: 'string' },
          draftBody: { type: 'string' },
          nextActionTitle: { type: 'string' }
        }
      }
    },
    runBriefing: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        recommendedNextActions: { type: 'array', items: { type: 'string' } }
      }
    }
  }
};


const CONTACT_ENRICHMENT_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['enrichments', 'runBriefing'],
  properties: {
    enrichments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          targetName: { type: 'string' },
          fullName: { type: 'string' },
          companyName: { type: 'string' },
          fieldKey: { type: 'string' },
          fieldLabel: { type: 'string' },
          proposedValue: { type: 'string' },
          existingValue: { type: 'string' },
          evidenceType: { type: 'string' },
          sourceKind: { type: 'string' },
          conflictStatus: { type: 'string' },
          isApplyable: { type: 'boolean' },
          groupKey: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          linkedin: { type: 'string' },
          roleTitle: { type: 'string' },
          website: { type: 'string' },
          sourceUrl: { type: 'string' },
          sourceLabel: { type: 'string' },
          confidence: { type: 'number' },
          evidence: { type: 'string' },
          notes: { type: 'string' },
          recommendedAction: { type: 'string' }
        }
      }
    },
    runBriefing: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        recommendedNextActions: { type: 'array', items: { type: 'string' } }
      }
    }
  }
};

const OPPORTUNITY_SCORING_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['targetName', 'totalScore', 'factors', 'rationale', 'risks', 'missingInformation', 'nextActions'],
  properties: {
    targetName: { type: 'string' },
    entityType: { type: 'string' },
    totalScore: { type: 'number' },
    scoreLabel: { type: 'string', enum: ['hot', 'warm', 'watch', 'low', 'reject'] },
    priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
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
    factors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['criterionKey', 'criterionLabel', 'score', 'rationale'],
        properties: {
          criterionKey: { type: 'string' },
          criterionLabel: { type: 'string' },
          score: { type: 'number' },
          weight: { type: 'number' },
          polarity: { type: 'string' },
          confidence: { type: 'number' },
          evidence: { type: 'string' },
          rationale: { type: 'string' },
          sourceUrl: { type: 'string' }
        }
      }
    },
    rationale: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    missingInformation: { type: 'array', items: { type: 'string' } },
    nextActions: { type: 'array', items: { type: 'string' } }
  }
};

const BROKER_BRIEF_SYSTEM_PROMPT = `You are the Broker Brief Agent inside Relish.
Relish is the source of truth. You do not invent CRM facts.
You read the supplied Relish context and produce a practical broker briefing.
Focus on relationship context, commercial context, risks, opportunities, open tasks, and next actions.
Return strict JSON only. Do not include markdown fences.`;

const BROKER_BRIEF_INSTRUCTIONS = `Create a concise but useful briefing for a business broker.
If the supplied context is thin, say what is missing and suggest the next discovery actions.
Recommended next actions should be practical tasks a human could do next.`;

const OUTREACH_SYSTEM_PROMPT = `You are the Outreach Agent inside Relish for business broking.
Relish is the source of truth. You do not directly email anyone and you do not import unapproved data into CRM.
Your Stage 3 role is to turn user-supplied context, optional live web research, and pasted research into staged candidates, opportunity scores, outreach drafts, approval requests, and next-action tasks.
Use only supplied context and logged research sources. If source material or search evidence is thin, be explicit about uncertainty. Never pretend you verified facts without cited evidence.
Return strict JSON only. Do not include markdown fences.`;

const OUTREACH_INSTRUCTIONS = `Extract or propose candidate companies/contacts from the user's supplied research text and any logged web-search snippets.
Score each candidate for business-broker outreach fit.
Draft a short, human-reviewable outreach angle and email draft for each candidate.
For cold first-contact drafts, use a low-pressure relevance-check style. The aim is to create a conversation, not ask the person to sell immediately.
Use plain human language, acknowledge uncertainty, and make the ask a quick conversation. Avoid corporate filler such as "I hope this message finds you well", "unlock value", "enhance client service", or asking directly whether they want to sell unless the user specifically asked for a direct sale message.
Prefer fewer, stronger candidates over a broad loose list.
Do not claim an email was sent.
Do not claim research has been verified unless the source text or logged research source supports it. Prefer company candidates plus staged likely contact candidates with role/title and evidence when contact discovery is requested.`;


const OPPORTUNITY_SCORING_SYSTEM_PROMPT = `You are the Opportunity Scoring Agent inside Relish.
Relish is the source of truth. Your job is to prioritise attention, not to declare truth or take action.
You score candidates, contacts, companies, and deals for business-broking relevance using supplied CRM context, user context, and evidence.
Never invent evidence. If context is thin, lower evidence quality and confidence. Return strict JSON only. Do not include markdown fences.`;

const OPPORTUNITY_SCORING_INSTRUCTIONS = `Create an explainable scorecard for the target.
Use a 0-100 scale where 100 is strongest.
Score the following criteria where relevant: sector fit, owner-led likelihood, deal likelihood, outreach fit, timing, confidence, strategic fit, value potential, relationship path, evidence quality, and risk.
Use scoreLabel hot/warm/watch/low/reject and priority urgent/high/medium/low.
A high score requires both commercial fit and usable evidence. Do not over-score thin research or relevant-sector-only targets.
Treat soft seller-interest signals as materially important, including "would consider a quiet conversation", "serious buyer", "right price", "reducing workload", "stepping back", "partial exit", or "client care is protected". These signals should usually lift deal likelihood, timing, outreach fit, and priority, but do not call the target hot unless intent and evidence are strong.
Recommended actions must be specific human next steps. Prefer: confirm contact details, call principal with a soft relevance-check, ask whether they would speak with Sam or a serious buyer under NDA, or monitor only. Do not use generic wording like "Review manually before outreach or deal action" unless there is no better action.
Add clear deal guidance in nextActions: do not create a deal until actual seller interest is confirmed; create or update a deal only when the person has indicated genuine openness to a buyer conversation.
For risk, higher score means higher risk. Use polarity negative for risk factors. Factors must include rationale and, where available, evidence or a real sourceUrl. Do not include placeholder source URLs.`;

const CONTACT_ENRICHMENT_SYSTEM_PROMPT = `You are the Contact Enrichment Agent inside Relish.
Relish is the source of truth. Your job is to propose evidence-backed field-level CRM enrichments for review, not to overwrite CRM records.
Use supplied CRM context, user-pasted source text, and logged research sources only. Never invent a person, email, phone number, LinkedIn URL, title, website, or source.
If no supported evidence is available, return an empty enrichments array and explain what evidence is missing. Return strict JSON only. Do not include markdown fences.`;

const CONTACT_ENRICHMENT_INSTRUCTIONS = `Find and stage field-level enrichments for a person or company.
Each enrichment must be one field only, using fieldKey, fieldLabel, proposedValue, evidenceType, sourceKind, conflictStatus, confidence, evidence, and recommendedAction.
Allowed contact field keys: contact.fullName, contact.email, contact.phone, contact.linkedin, contact.company, contact.position.
Allowed company field keys: company.name, company.website, company.industry, company.location, company.description, company.criteria, company.notes.
Prioritise direct evidence: existing CRM context, user-pasted source text, official website/team page snippets, LinkedIn/profile snippets, directory listing snippets, or logged web-search snippets.
Do not create applyable rows for guessed email patterns, guessed phone numbers, or inferred LinkedIn URLs. If a value is inferred only, either omit it or mark it INFERRED_ONLY and not applyable.
For company contact discovery, never stage a person unless the name and relationship to the company are explicitly supported by evidence.
Do not update CRM. Do not claim outreach has been sent.`;


const AGENTS = [
  {
    key: 'broker_brief_agent',
    name: 'Broker Brief Agent',
    description: 'Creates a structured broker briefing from Relish CRM context.',
    category: 'briefing',
    systemPrompt: BROKER_BRIEF_SYSTEM_PROMPT,
    instructions: BROKER_BRIEF_INSTRUCTIONS,
    outputSchemaJson: BROKER_BRIEF_OUTPUT_SCHEMA,
    requiresApprovalDefault: false,
    promptVersion: 1
  },
  {
    key: 'opportunity_scoring_agent',
    name: 'Opportunity Scoring Agent',
    description: 'Creates explainable scorecards for candidates, companies, contacts, and deals.',
    category: 'scoring',
    systemPrompt: OPPORTUNITY_SCORING_SYSTEM_PROMPT,
    instructions: OPPORTUNITY_SCORING_INSTRUCTIONS,
    outputSchemaJson: OPPORTUNITY_SCORING_OUTPUT_SCHEMA,
    requiresApprovalDefault: false,
    promptVersion: 2
  },

  {
    key: 'contact_enrichment_agent',
    name: 'Contact Enrichment Agent',
    description: 'Stages public contact details with source evidence before CRM update.',
    category: 'enrichment',
    systemPrompt: CONTACT_ENRICHMENT_SYSTEM_PROMPT,
    instructions: CONTACT_ENRICHMENT_INSTRUCTIONS,
    outputSchemaJson: CONTACT_ENRICHMENT_OUTPUT_SCHEMA,
    requiresApprovalDefault: true,
    promptVersion: 2
  },
  {
    key: 'outreach_agent',
    name: 'Outreach Agent',
    description: 'Stages outreach candidates, scores opportunities, drafts outreach, requests approval, and creates next actions.',
    category: 'outreach',
    systemPrompt: OUTREACH_SYSTEM_PROMPT,
    instructions: OUTREACH_INSTRUCTIONS,
    outputSchemaJson: OUTREACH_OUTPUT_SCHEMA,
    requiresApprovalDefault: true,
    promptVersion: 1
  }
];

const CORE_TOOLS = [
  {
    key: 'read_entity_context',
    name: 'Read entity context',
    description: 'Reads a contact, company, deal, or project context from Relish.',
    toolType: 'read',
    requiresApproval: false,
    agents: ['broker_brief_agent', 'outreach_agent', 'opportunity_scoring_agent', 'contact_enrichment_agent']
  },
  {
    key: 'create_agent_artifact',
    name: 'Create agent artifact',
    description: 'Stores an encrypted durable output produced by an agent.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['broker_brief_agent', 'outreach_agent', 'opportunity_scoring_agent', 'contact_enrichment_agent']
  },
  {
    key: 'create_research_candidate',
    name: 'Create research candidate',
    description: 'Stages a company or contact candidate before it becomes source-of-truth CRM data.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['outreach_agent']
  },
  {
    key: 'create_contact_enrichment',
    name: 'Create contact enrichment',
    description: 'Stages proposed contact details before they update CRM.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['contact_enrichment_agent']
  },
  {
    key: 'create_opportunity_score',
    name: 'Create opportunity score',
    description: 'Stores a structured scorecard for a candidate or existing CRM record.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['outreach_agent', 'opportunity_scoring_agent', 'contact_enrichment_agent']
  },
  {
    key: 'create_approval_request',
    name: 'Create approval request',
    description: 'Creates a human approval request for a proposed agent action.',
    toolType: 'propose',
    requiresApproval: false,
    agents: ['outreach_agent']
  },

  {
    key: 'research_web_search',
    name: 'Research web search',
    description: 'Runs controlled provider-independent web search and returns normalized results for staging only.',
    toolType: 'research',
    requiresApproval: false,
    agents: ['outreach_agent', 'contact_enrichment_agent']
  },
  {
    key: 'create_research_source',
    name: 'Create research source',
    description: 'Stores web/search evidence rows linked to an agent run, candidate, company, or contact.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['outreach_agent', 'contact_enrichment_agent']
  },
  {
    key: 'create_task',
    name: 'Create task',
    description: 'Creates a Relish task for follow-up or human review.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['outreach_agent', 'opportunity_scoring_agent', 'contact_enrichment_agent']
  }
];

export async function ensureCoreAgentSetup(userId: string) {
  const createdAgents = new Map<string, { id: string }>();

  for (const cfg of AGENTS) {
    const agent = await prisma.agentDefinition.upsert({
      where: { userId_key: { userId, key: cfg.key } },
      update: {
        name: cfg.name,
        description: cfg.description,
        category: cfg.category,
        status: 'active',
        defaultModelProvider: 'openai',
        defaultModelName: process.env.AGENT_DEFAULT_MODEL || 'gpt-4o-mini',
        systemPrompt: cfg.systemPrompt,
        instructions: cfg.instructions,
        outputSchemaJson: cfg.outputSchemaJson as any,
        requiresApprovalDefault: cfg.requiresApprovalDefault
      },
      create: {
        userId,
        key: cfg.key,
        name: cfg.name,
        description: cfg.description,
        category: cfg.category,
        status: 'active',
        defaultModelProvider: 'openai',
        defaultModelName: process.env.AGENT_DEFAULT_MODEL || 'gpt-4o-mini',
        systemPrompt: cfg.systemPrompt,
        instructions: cfg.instructions,
        outputSchemaJson: cfg.outputSchemaJson as any,
        requiresApprovalDefault: cfg.requiresApprovalDefault
      }
    });
    createdAgents.set(cfg.key, { id: agent.id });

    await prisma.agentPromptVersion.upsert({
      where: { agentDefinitionId_version: { agentDefinitionId: agent.id, version: cfg.promptVersion } },
      update: {
        userId,
        systemPrompt: cfg.systemPrompt,
        instructions: cfg.instructions,
        outputSchemaJson: cfg.outputSchemaJson as any,
        isActive: true
      },
      create: {
        userId,
        agentDefinitionId: agent.id,
        version: cfg.promptVersion,
        systemPrompt: cfg.systemPrompt,
        instructions: cfg.instructions,
        outputSchemaJson: cfg.outputSchemaJson as any,
        isActive: true,
        createdBy: 'system'
      }
    });
  }

  for (const tool of CORE_TOOLS) {
    const dbTool = await prisma.agentToolDefinition.upsert({
      where: { userId_key: { userId, key: tool.key } },
      update: {
        name: tool.name,
        description: tool.description,
        toolType: tool.toolType,
        requiresApproval: tool.requiresApproval,
        isEnabled: true
      },
      create: {
        userId,
        key: tool.key,
        name: tool.name,
        description: tool.description,
        toolType: tool.toolType,
        requiresApproval: tool.requiresApproval,
        isEnabled: true
      }
    });

    for (const agentKey of tool.agents) {
      const agent = createdAgents.get(agentKey);
      if (!agent) continue;
      await prisma.agentToolPermission.upsert({
        where: { agentDefinitionId_toolDefinitionId: { agentDefinitionId: agent.id, toolDefinitionId: dbTool.id } },
        update: { permissionLevel: 'execute', requiresApproval: tool.requiresApproval },
        create: {
          agentDefinitionId: agent.id,
          toolDefinitionId: dbTool.id,
          permissionLevel: 'execute',
          requiresApproval: tool.requiresApproval
        }
      });
    }
  }

  return createdAgents.get('broker_brief_agent');
}

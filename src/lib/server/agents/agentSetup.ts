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
Prefer fewer, stronger candidates over a broad loose list.
Do not claim an email was sent.
Do not claim research has been verified unless the source text or logged research source supports it. Prefer company candidates plus staged likely contact candidates with role/title and evidence when contact discovery is requested.`;

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
    agents: ['broker_brief_agent', 'outreach_agent']
  },
  {
    key: 'create_agent_artifact',
    name: 'Create agent artifact',
    description: 'Stores an encrypted durable output produced by an agent.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['broker_brief_agent', 'outreach_agent']
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
    key: 'create_opportunity_score',
    name: 'Create opportunity score',
    description: 'Stores a structured scorecard for a candidate or existing CRM record.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['outreach_agent']
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
    agents: ['outreach_agent']
  },
  {
    key: 'create_research_source',
    name: 'Create research source',
    description: 'Stores web/search evidence rows linked to an agent run, candidate, company, or contact.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['outreach_agent']
  },
  {
    key: 'create_task',
    name: 'Create task',
    description: 'Creates a Relish task for follow-up or human review.',
    toolType: 'write',
    requiresApproval: false,
    agents: ['outreach_agent']
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

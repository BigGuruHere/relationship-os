// src/lib/server/agents/agentSetup.ts
// PURPOSE: Create the Stage 1 agent definition and tool definitions if missing.

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

const BROKER_BRIEF_SYSTEM_PROMPT = `You are the Broker Brief Agent inside Relish.
Relish is the source of truth. You do not invent CRM facts.
You read the supplied Relish context and produce a practical broker briefing.
Focus on relationship context, commercial context, risks, opportunities, open tasks, and next actions.
Return strict JSON only. Do not include markdown fences.`;

const BROKER_BRIEF_INSTRUCTIONS = `Create a concise but useful briefing for a business broker.
If the supplied context is thin, say what is missing and suggest the next discovery actions.
Recommended next actions should be practical tasks a human could do next.`;

const CORE_TOOLS = [
  {
    key: 'read_entity_context',
    name: 'Read entity context',
    description: 'Reads a contact, company, deal, or project context from Relish.',
    toolType: 'read',
    requiresApproval: false
  },
  {
    key: 'create_agent_artifact',
    name: 'Create agent artifact',
    description: 'Stores an encrypted durable output produced by an agent.',
    toolType: 'write',
    requiresApproval: false
  }
];

export async function ensureCoreAgentSetup(userId: string) {
  const agent = await prisma.agentDefinition.upsert({
    where: {
      userId_key: {
        userId,
        key: 'broker_brief_agent'
      }
    },
    update: {
      name: 'Broker Brief Agent',
      description: 'Creates a structured broker briefing from Relish CRM context.',
      category: 'briefing',
      status: 'active',
      defaultModelProvider: 'openai',
      defaultModelName: process.env.AGENT_DEFAULT_MODEL || 'gpt-4o-mini',
      systemPrompt: BROKER_BRIEF_SYSTEM_PROMPT,
      instructions: BROKER_BRIEF_INSTRUCTIONS,
      outputSchemaJson: BROKER_BRIEF_OUTPUT_SCHEMA as any
    },
    create: {
      userId,
      key: 'broker_brief_agent',
      name: 'Broker Brief Agent',
      description: 'Creates a structured broker briefing from Relish CRM context.',
      category: 'briefing',
      status: 'active',
      defaultModelProvider: 'openai',
      defaultModelName: process.env.AGENT_DEFAULT_MODEL || 'gpt-4o-mini',
      systemPrompt: BROKER_BRIEF_SYSTEM_PROMPT,
      instructions: BROKER_BRIEF_INSTRUCTIONS,
      outputSchemaJson: BROKER_BRIEF_OUTPUT_SCHEMA as any,
      requiresApprovalDefault: false
    }
  });

  await prisma.agentPromptVersion.upsert({
    where: {
      agentDefinitionId_version: {
        agentDefinitionId: agent.id,
        version: 1
      }
    },
    update: {
      userId,
      systemPrompt: BROKER_BRIEF_SYSTEM_PROMPT,
      instructions: BROKER_BRIEF_INSTRUCTIONS,
      outputSchemaJson: BROKER_BRIEF_OUTPUT_SCHEMA as any,
      isActive: true
    },
    create: {
      userId,
      agentDefinitionId: agent.id,
      version: 1,
      systemPrompt: BROKER_BRIEF_SYSTEM_PROMPT,
      instructions: BROKER_BRIEF_INSTRUCTIONS,
      outputSchemaJson: BROKER_BRIEF_OUTPUT_SCHEMA as any,
      isActive: true,
      createdBy: 'system'
    }
  });

  for (const tool of CORE_TOOLS) {
    const dbTool = await prisma.agentToolDefinition.upsert({
      where: {
        userId_key: {
          userId,
          key: tool.key
        }
      },
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

    await prisma.agentToolPermission.upsert({
      where: {
        agentDefinitionId_toolDefinitionId: {
          agentDefinitionId: agent.id,
          toolDefinitionId: dbTool.id
        }
      },
      update: {
        permissionLevel: 'execute',
        requiresApproval: tool.requiresApproval
      },
      create: {
        agentDefinitionId: agent.id,
        toolDefinitionId: dbTool.id,
        permissionLevel: 'execute',
        requiresApproval: tool.requiresApproval
      }
    });
  }

  return agent;
}

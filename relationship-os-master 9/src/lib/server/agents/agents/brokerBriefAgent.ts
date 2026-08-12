// src/lib/server/agents/agents/brokerBriefAgent.ts
// PURPOSE: First production-safe agent. It reads Relish context and creates a broker briefing artifact.

import { prisma } from '$lib/db';
import { executeAgentTool } from '$lib/server/agents/toolRegistry';
import { generateStructured } from '$lib/server/agents/modelGateway';
import { createAgentStep, completeAgentStep, failAgentStep } from '$lib/server/agents/agentLogger';
import { completeAgentRun, failAgentRun, startAgentRun } from '$lib/server/agents/runtime';
import type { AgentEntityType, BrokerBriefingOutput } from '$lib/server/agents/types';

type RunBrokerBriefInput = {
  userId: string;
  entityType: AgentEntityType;
  entityId: string;
  briefingPurpose?: string;
};

const OUTPUT_SCHEMA = {
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

function normaliseList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12);
}

function normaliseBriefing(raw: BrokerBriefingOutput | null, entityType: string): BrokerBriefingOutput {
  const fallbackTitle = `Broker briefing for ${entityType}`;
  return {
    title: String(raw?.title || fallbackTitle).trim() || fallbackTitle,
    summary: String(raw?.summary || '').trim(),
    context: normaliseList(raw?.context),
    keyPeople: normaliseList(raw?.keyPeople),
    openTasks: normaliseList(raw?.openTasks),
    risks: normaliseList(raw?.risks),
    opportunities: normaliseList(raw?.opportunities),
    recommendedNextActions: normaliseList(raw?.recommendedNextActions)
  };
}

function briefingToMarkdown(brief: BrokerBriefingOutput) {
  const section = (title: string, rows: string[]) => {
    if (!rows.length) return `\n## ${title}\n- None identified from the available Relish context.\n`;
    return `\n## ${title}\n${rows.map((row) => `- ${row}`).join('\n')}\n`;
  };

  return [
    `# ${brief.title}`,
    '',
    brief.summary,
    section('Context', brief.context),
    section('Key people', brief.keyPeople),
    section('Open tasks', brief.openTasks),
    section('Risks', brief.risks),
    section('Opportunities', brief.opportunities),
    section('Recommended next actions', brief.recommendedNextActions)
  ].join('\n').trim();
}

export async function runBrokerBriefAgent(input: RunBrokerBriefInput) {
  const { agent, activePrompt, run } = await startAgentRun({
    userId: input.userId,
    agentKey: 'broker_brief_agent',
    triggerType: 'manual',
    triggerEntityType: input.entityType,
    triggerEntityId: input.entityId,
    inputJson: {
      entityType: input.entityType,
      entityId: input.entityId,
      briefingPurpose: input.briefingPurpose ?? 'Prepare a practical broker briefing.'
    }
  });

  try {
    const readStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'read_context',
      stepName: 'Read Relish context',
      inputJson: { entityType: input.entityType, entityId: input.entityId }
    });

    const context = await executeAgentTool('read_entity_context', {
      entityType: input.entityType,
      entityId: input.entityId
    }, {
      userId: input.userId,
      agentRunId: run.id,
      agentStepId: readStep.id,
      agentDefinitionId: agent.id
    });

    await completeAgentStep(readStep.id, { contextKeys: Object.keys(context || {}) });

    const modelStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'generate_briefing',
      stepName: 'Generate structured briefing',
      inputJson: { entityType: input.entityType, entityId: input.entityId }
    });

    const systemPrompt = activePrompt?.systemPrompt ?? agent.systemPrompt;
    const instructions = activePrompt?.instructions ?? agent.instructions ?? '';

    const modelResult = await generateStructured<BrokerBriefingOutput>({
      userId: input.userId,
      agentRunId: run.id,
      agentStepId: modelStep.id,
      provider: agent.defaultModelProvider,
      model: agent.defaultModelName,
      purpose: 'broker_briefing',
      systemPrompt,
      outputSchema: activePrompt?.outputSchemaJson ?? agent.outputSchemaJson ?? OUTPUT_SCHEMA,
      userPrompt: [
        instructions,
        '',
        `Briefing purpose: ${input.briefingPurpose || 'Prepare a practical broker briefing.'}`,
        '',
        'Relish context:',
        JSON.stringify(context, null, 2)
      ].join('\n')
    });

    const briefing = normaliseBriefing(modelResult.structured, input.entityType);
    await completeAgentStep(modelStep.id, briefing);

    const writeStep = await createAgentStep({
      agentRunId: run.id,
      stepKey: 'store_artifact',
      stepName: 'Store broker briefing artifact',
      inputJson: { artifactType: 'broker_briefing', entityType: input.entityType, entityId: input.entityId }
    });

    const content = briefingToMarkdown(briefing);
    const artifact = await executeAgentTool('create_agent_artifact', {
      artifactType: 'broker_briefing',
      title: briefing.title,
      content,
      summary: briefing.summary,
      structuredJson: briefing,
      entityType: input.entityType,
      entityId: input.entityId
    }, {
      userId: input.userId,
      agentRunId: run.id,
      agentStepId: writeStep.id,
      agentDefinitionId: agent.id
    });

    await completeAgentStep(writeStep.id, artifact);
    await completeAgentRun(run.id, { artifact, briefing });

    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  } catch (error) {
    // IT: Mark any currently running step as failed for clearer diagnostics.
    const runningStep = await prisma.agentStep.findFirst({
      where: { agentRunId: run.id, status: 'running' },
      orderBy: { createdAt: 'desc' }
    });
    if (runningStep) await failAgentStep(runningStep.id, error);
    await failAgentRun(run.id, error);
    return prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
  }
}

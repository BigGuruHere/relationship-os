// src/lib/server/agents/types.ts
// PURPOSE: Shared Stage 1 Agent Framework types.

export type AgentEntityType = 'contact' | 'company' | 'deal' | 'project';

export type ToolContext = {
  userId: string;
  agentRunId: string;
  agentStepId?: string;
  agentDefinitionId?: string;
};

export type ToolDefinition<Input, Output> = {
  key: string;
  description: string;
  requiresApproval: boolean;
  execute: (input: Input, context: ToolContext) => Promise<Output>;
};

export type BrokerBriefingOutput = {
  title: string;
  summary: string;
  context: string[];
  keyPeople: string[];
  openTasks: string[];
  risks: string[];
  opportunities: string[];
  recommendedNextActions: string[];
};

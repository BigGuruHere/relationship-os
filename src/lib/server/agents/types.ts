// src/lib/server/agents/types.ts
// PURPOSE: Shared Stage 1 Agent Framework types.

export type AgentEntityType = 'contact' | 'company' | 'deal' | 'project' | 'research_candidate' | 'research_source';

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

export type OutreachCandidateOutput = {
  entityType?: 'COMPANY' | 'CONTACT';
  name: string;
  website?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  confidence?: number;
  notes?: string;
  totalScore?: number;
  sectorFitScore?: number;
  ownerLedScore?: number;
  dealLikelihoodScore?: number;
  outreachFitScore?: number;
  timingScore?: number;
  confidenceScore?: number;
  scoreRationale?: string[];
  outreachAngle?: string;
  draftSubject?: string;
  draftBody?: string;
  nextActionTitle?: string;
  roleTitle?: string;
  companyName?: string;
  contactResearchReason?: string;
  sourceEvidence?: { title?: string; url?: string; snippet?: string }[];
};

export type OutreachAgentOutput = {
  candidates: OutreachCandidateOutput[];
  runBriefing?: {
    title?: string;
    summary?: string;
    recommendedNextActions?: string[];
  };
};

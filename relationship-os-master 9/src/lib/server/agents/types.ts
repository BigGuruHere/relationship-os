// src/lib/server/agents/types.ts
// PURPOSE: Shared Stage 1 Agent Framework types.

export type AgentEntityType = 'contact' | 'company' | 'deal' | 'project' | 'research_candidate' | 'research_source' | 'opportunity_score' | 'contact_enrichment';

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
  strategicFitScore?: number;
  valuePotentialScore?: number;
  relationshipPathScore?: number;
  evidenceQualityScore?: number;
  riskScore?: number;
  scoreLabel?: string;
  priority?: string;
  recommendedAction?: string;
  scoreFactors?: OpportunityScoreFactorOutput[];
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


export type OpportunityScoreFactorOutput = {
  criterionKey: string;
  criterionLabel: string;
  score: number;
  weight?: number;
  polarity?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  evidence?: string;
  rationale?: string;
  sourceUrl?: string;
};

export type OpportunityScoringOutput = {
  targetName: string;
  entityType?: 'COMPANY' | 'CONTACT' | 'DEAL' | 'RESEARCH_CANDIDATE';
  totalScore: number;
  scoreLabel?: string;
  priority?: string;
  recommendedAction?: string;
  sectorFitScore?: number;
  ownerLedScore?: number;
  dealLikelihoodScore?: number;
  outreachFitScore?: number;
  timingScore?: number;
  confidenceScore?: number;
  strategicFitScore?: number;
  valuePotentialScore?: number;
  relationshipPathScore?: number;
  evidenceQualityScore?: number;
  riskScore?: number;
  factors: OpportunityScoreFactorOutput[];
  rationale: string[];
  risks: string[];
  missingInformation: string[];
  nextActions: string[];
};


export type ContactEnrichmentOutput = {
  targetName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  companyName?: string;
  roleTitle?: string;
  website?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  confidence?: number;
  evidence?: string;
  notes?: string;
  recommendedAction?: string;
};

export type ContactEnrichmentAgentOutput = {
  enrichments: ContactEnrichmentOutput[];
  runBriefing?: {
    title?: string;
    summary?: string;
    recommendedNextActions?: string[];
  };
};

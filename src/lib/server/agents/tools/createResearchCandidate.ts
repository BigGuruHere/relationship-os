// src/lib/server/agents/tools/createResearchCandidate.ts
// PURPOSE: Stage outreach research as candidates before importing into source-of-truth CRM tables.

import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import type { ToolDefinition } from '$lib/server/agents/types';

type CreateResearchCandidateInput = {
  entityType?: 'COMPANY' | 'CONTACT';
  name: string;
  website?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  confidence?: number;
  notes?: string;
  structuredJson?: unknown;
};

type CreateResearchCandidateOutput = {
  id: string;
  createdEntityType: 'research_candidate';
  createdEntityId: string;
};

function clampScore(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export const createResearchCandidateTool: ToolDefinition<CreateResearchCandidateInput, CreateResearchCandidateOutput> = {
  key: 'create_research_candidate',
  description: 'Stages a company or contact candidate before importing it into CRM.',
  requiresApproval: false,
  execute: async (input, context) => {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Candidate name is required.');

    const candidate = await prisma.researchCandidate.create({
      data: {
        userId: context.userId,
        agentRunId: context.agentRunId,
        entityType: input.entityType === 'CONTACT' ? 'CONTACT' : 'COMPANY',
        status: 'CANDIDATE',
        nameEnc: encrypt(name, 'research_candidate.name'),
        nameIdx: buildIndexToken(name),
        websiteEnc: input.website?.trim() ? encrypt(input.website.trim(), 'research_candidate.website') : null,
        websiteIdx: input.website?.trim() ? buildIndexToken(input.website.trim()) : null,
        sourceUrlEnc: input.sourceUrl?.trim() ? encrypt(input.sourceUrl.trim(), 'research_candidate.source_url') : null,
        sourceLabelEnc: input.sourceLabel?.trim() ? encrypt(input.sourceLabel.trim(), 'research_candidate.source_label') : null,
        confidence: clampScore(input.confidence),
        structuredJson: (input.structuredJson ?? {}) as any,
        notesEnc: input.notes?.trim() ? encrypt(input.notes.trim(), 'research_candidate.notes') : null
      }
    });

    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: 'research_candidate',
        entityId: candidate.id,
        role: 'created_candidate'
      }
    });

    return { id: candidate.id, createdEntityType: 'research_candidate', createdEntityId: candidate.id };
  }
};

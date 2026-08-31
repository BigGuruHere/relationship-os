// src/lib/server/agents/tools/createResearchSource.ts
// PURPOSE: Store research evidence/source rows from web search or extracted research.

import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import type { ToolDefinition } from '$lib/server/agents/types';
import { createAgentCoreAccess } from '$lib/server/core/accessPolicy';
import { assertOwnedCanonicalRefs } from '$lib/server/core/relationshipRepository';
import { getOwnedResearchCandidate } from '$lib/server/agents/stagingRepository';

type Input = {
  sourceType?: string;
  provider?: string;
  query?: string;
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
  evidenceJson?: unknown;
  confidence?: number;
  researchCandidateId?: string;
  companyId?: string;
  contactId?: string;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function clamp(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sourceType(value: unknown) {
  const raw = clean(value).toUpperCase();
  return ['SEARCH_RESULT', 'WEB_PAGE', 'USER_SOURCE', 'EXTRACTED_PROFILE', 'OTHER'].includes(raw) ? raw : 'SEARCH_RESULT';
}

export const createResearchSourceTool: ToolDefinition<Input, { id: string; createdEntityType: string; createdEntityId: string }> = {
  key: 'create_research_source',
  description: 'Stores a source/evidence row from agent research without importing it as CRM truth.',
  requiresApproval: false,
  execute: async (input, context) => {
    // IT: Evidence may reference canonical relationship records, but only inside the current workspace.
    const access = createAgentCoreAccess({ userId: context.userId, agentDefinitionId: context.agentDefinitionId, purpose: 'create_research_source' });
    await assertOwnedCanonicalRefs(access, { contactId: clean(input.contactId) || null, companyId: clean(input.companyId) || null });
    if (clean(input.researchCandidateId)) {
      const candidate = await getOwnedResearchCandidate(context.userId, clean(input.researchCandidateId), context.agentRunId);
      if (!candidate) throw new Error('Research candidate not found in this agent run.');
    }

    const row = await prisma.researchSource.create({
      data: {
        userId: context.userId,
        agentRunId: context.agentRunId,
        researchCandidateId: clean(input.researchCandidateId) || null,
        companyId: clean(input.companyId) || null,
        contactId: clean(input.contactId) || null,
        sourceType: sourceType(input.sourceType) as any,
        provider: clean(input.provider) || 'manual',
        confidence: clamp(input.confidence),
        queryEnc: clean(input.query) ? encrypt(clean(input.query), 'research_source.query') : null,
        titleEnc: clean(input.title) ? encrypt(clean(input.title), 'research_source.title') : null,
        urlEnc: clean(input.url) ? encrypt(clean(input.url), 'research_source.url') : null,
        snippetEnc: clean(input.snippet) ? encrypt(clean(input.snippet), 'research_source.snippet') : null,
        contentEnc: clean(input.content) ? encrypt(clean(input.content), 'research_source.content') : null,
        evidenceJson: (input.evidenceJson ?? {}) as any,
        fetchedAt: new Date()
      }
    });

    return { id: row.id, createdEntityType: 'research_source', createdEntityId: row.id };
  }
};

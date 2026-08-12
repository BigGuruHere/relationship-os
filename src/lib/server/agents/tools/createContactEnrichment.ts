// src/lib/server/agents/tools/createContactEnrichment.ts
// PURPOSE: Stage proposed contact details found by an agent. Do not update CRM truth automatically.

import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import type { ToolDefinition } from '$lib/server/agents/types';

type Input = {
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
  evidence?: string;
  notes?: string;
  confidence?: number;
  structuredJson?: unknown;
  researchCandidateId?: string;
  companyId?: string;
  contactId?: string;
};

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function clamp(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function enc(value: unknown, aad: string) {
  const text = clean(value);
  return text ? encrypt(text, aad) : null;
}

export const createContactEnrichmentTool: ToolDefinition<Input, { id: string; createdEntityType: string; createdEntityId: string }> = {
  key: 'create_contact_enrichment',
  description: 'Stages proposed public contact details for review before CRM update.',
  requiresApproval: false,
  execute: async (input, context) => {
    const hasAnyDetail = [input.fullName, input.email, input.phone, input.linkedin, input.companyName, input.roleTitle, input.website].some((v) => clean(v));
    if (!hasAnyDetail) throw new Error('At least one proposed enrichment detail is required.');

    const row = await prisma.contactEnrichment.create({
      data: {
        userId: context.userId,
        agentRunId: context.agentRunId,
        researchCandidateId: clean(input.researchCandidateId) || null,
        companyId: clean(input.companyId) || null,
        contactId: clean(input.contactId) || null,
        status: 'CANDIDATE',
        confidence: clamp(input.confidence),
        targetNameEnc: enc(input.targetName, 'contact_enrichment.target_name'),
        fullNameEnc: enc(input.fullName, 'contact_enrichment.full_name'),
        emailEnc: enc(input.email, 'contact_enrichment.email'),
        phoneEnc: enc(input.phone, 'contact_enrichment.phone'),
        linkedinEnc: enc(input.linkedin, 'contact_enrichment.linkedin'),
        companyNameEnc: enc(input.companyName, 'contact_enrichment.company_name'),
        roleTitleEnc: enc(input.roleTitle, 'contact_enrichment.role_title'),
        websiteEnc: enc(input.website, 'contact_enrichment.website'),
        sourceUrlEnc: enc(input.sourceUrl, 'contact_enrichment.source_url'),
        sourceLabelEnc: enc(input.sourceLabel, 'contact_enrichment.source_label'),
        evidenceEnc: enc(input.evidence, 'contact_enrichment.evidence'),
        notesEnc: enc(input.notes, 'contact_enrichment.notes'),
        structuredJson: (input.structuredJson ?? {}) as any
      }
    });

    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: 'contact_enrichment',
        entityId: row.id,
        role: 'created_enrichment'
      }
    });

    return { id: row.id, createdEntityType: 'contact_enrichment', createdEntityId: row.id };
  }
};

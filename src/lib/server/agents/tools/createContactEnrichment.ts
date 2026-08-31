// src/lib/server/agents/tools/createContactEnrichment.ts
// PURPOSE: Stage proposed enrichment fields for review before CRM update.

import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import type { ToolDefinition } from '$lib/server/agents/types';
import { createAgentCoreAccess } from '$lib/server/core/accessPolicy';
import { assertOwnedCanonicalRefs } from '$lib/server/core/relationshipRepository';
import { getOwnedResearchCandidate } from '$lib/server/agents/stagingRepository';

type Input = {
  targetName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  companyName?: string;
  roleTitle?: string;
  website?: string;
  fieldKey?: string;
  fieldLabel?: string;
  proposedValue?: string;
  existingValue?: string;
  evidenceType?: string;
  sourceKind?: string;
  conflictStatus?: string;
  isApplyable?: boolean;
  groupKey?: string;
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

function cleanKey(value: unknown) {
  return clean(value).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120);
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
  description: 'Stages one proposed contact/company enrichment field for review before CRM update.',
  requiresApproval: false,
  execute: async (input, context) => {
    const proposedValue = clean(input.proposedValue);
    const hasLegacyDetail = [input.fullName, input.email, input.phone, input.linkedin, input.companyName, input.roleTitle, input.website].some((v) => clean(v));
    if (!proposedValue && !hasLegacyDetail) throw new Error('At least one proposed enrichment detail is required.');

    const fieldKey = cleanKey(input.fieldKey);

    // IT: Stage 8.1 validates canonical relationship references before staging enrichment against them.
    const access = createAgentCoreAccess({ userId: context.userId, agentDefinitionId: context.agentDefinitionId, purpose: 'create_contact_enrichment' });
    await assertOwnedCanonicalRefs(access, { contactId: clean(input.contactId) || null, companyId: clean(input.companyId) || null });
    if (clean(input.researchCandidateId)) {
      const candidate = await getOwnedResearchCandidate(context.userId, clean(input.researchCandidateId), context.agentRunId);
      if (!candidate) throw new Error('Research candidate not found in this agent run.');
    }

    const conflictStatus = clean(input.conflictStatus || 'NEW').toUpperCase();
    const isApplyable = input.isApplyable !== false && !['VERIFIED_EXISTING', 'INFERRED_ONLY', 'UNSUPPORTED', 'NO_CHANGE'].includes(conflictStatus);

    const row = await prisma.contactEnrichment.create({
      data: {
        userId: context.userId,
        agentRunId: context.agentRunId,
        researchCandidateId: clean(input.researchCandidateId) || null,
        companyId: clean(input.companyId) || null,
        contactId: clean(input.contactId) || null,
        status: 'CANDIDATE',
        confidence: clamp(input.confidence),
        groupKey: clean(input.groupKey) || null,
        fieldKey: fieldKey || null,
        fieldLabel: clean(input.fieldLabel) || null,
        proposedValueEnc: enc(input.proposedValue, 'contact_enrichment.proposed_value'),
        existingValueEnc: enc(input.existingValue, 'contact_enrichment.existing_value'),
        evidenceType: clean(input.evidenceType || 'UNKNOWN').toUpperCase(),
        sourceKind: clean(input.sourceKind) || null,
        conflictStatus: conflictStatus || 'NEW',
        isApplyable,
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

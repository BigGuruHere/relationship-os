// src/lib/server/core/knowledge.ts
// PURPOSE: Canonical Stage 8.4 KnowledgeClaim + evidence reconciliation and reviewed promotion into structured Core records.
// SECURITY: Every read/write is workspace scoped. Claims are encrypted; deterministic indexes are equality-only and field scoped.

import { prisma } from '$lib/db';
import { buildScopedIndexToken, decrypt, encrypt } from '$lib/crypto';
import type { CoreAccessContext } from '$lib/server/core/accessPolicy';
import { findCoreInteraction } from '$lib/server/core/relationshipRepository';
import { normaliseKnowledgeAuthority, knowledgeAuthorityLabel, knowledgeSourceTypeLabel } from '$lib/provenance';
import { knowledgeClaimKindLabel, knowledgeClaimStatusLabel, knowledgeConfidenceLabel, normaliseKnowledgeClaimKind, normaliseKnowledgeConfidence } from '$lib/knowledge';
import { createWantFromForm } from '$lib/server/wants';
import { createOfferFromForm } from '$lib/server/offers';
import { objectiveStatusLabel, objectiveConfidenceLabel } from '$lib/objectives';
import { importanceLabel } from '$lib/intents';

function subjectWhere(subject: { contactId: string | null; personId: string | null; companyId: string | null }) {
  return {
    contactId: subject.contactId,
    personId: subject.personId,
    companyId: subject.companyId
  };
}

function safeDecrypt(payload: string | null | undefined, aad: string) {
  if (!payload) return '';
  try { return decrypt(payload, aad); } catch { return ''; }
}

function titleFromStatement(statement: string) {
  const clean = statement.replace(/\s+/g, ' ').trim();
  return clean.length <= 120 ? clean : `${clean.slice(0, 117)}...`;
}

export async function captureKnowledgeFromInteraction(params: {
  context: CoreAccessContext;
  interactionId: string;
  kind: FormDataEntryValue | string | null | undefined;
  statement: string;
  authority: FormDataEntryValue | string | null | undefined;
  confidence: FormDataEntryValue | string | null | undefined;
  evidenceNote?: string | null;
}) {
  const { context } = params;
  const interaction = await findCoreInteraction(context, params.interactionId, {
    id: true,
    contactId: true,
    personId: true,
    companyId: true,
    occurredAt: true
  });
  if (!interaction) throw new Error('Source interaction not found in this workspace.');

  const statement = String(params.statement || '').trim();
  if (!statement) throw new Error('Knowledge statement is required.');
  const kind = normaliseKnowledgeClaimKind(params.kind);
  const authority = normaliseKnowledgeAuthority(params.authority, 'WORKSPACE_RECORDED');
  const confidence = normaliseKnowledgeConfidence(params.confidence);
  const statementIdx = buildScopedIndexToken(statement, 'knowledge:claim:statement');
  const subject = { contactId: interaction.contactId, personId: interaction.personId, companyId: interaction.companyId };
  const evidenceNote = String(params.evidenceNote || '').trim();

  const existing = await prisma.knowledgeClaim.findFirst({
    where: {
      userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId,
      kind: kind as any,
      status: 'ACTIVE' as any,
      statementIdx,
      ...subjectWhere(subject)
    },
    select: { id: true }
  });

  if (existing) {
    const priorEvidence = await prisma.knowledgeEvidence.findFirst({
      where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, claimId: existing.id, sourceInteractionId: interaction.id },
      select: { id: true, status: true }
    });
    if (!priorEvidence) {
      await prisma.knowledgeEvidence.create({
        data: {
          userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId,
          claimId: existing.id,
          sourceInteractionId: interaction.id,
          sourceType: 'INTERACTION' as any,
          authority: authority as any,
          confidence: confidence as any,
          noteEnc: evidenceNote ? encrypt(evidenceNote, 'knowledge.evidence_note') : null,
          observedAt: interaction.occurredAt
        }
      });
    } else if (priorEvidence.status !== 'ACTIVE') {
      // IT: Re-capturing the same statement from the same source explicitly restores that evidence.
      await prisma.knowledgeEvidence.updateMany({
        where: { id: priorEvidence.id, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, claimId: existing.id },
        data: { status: 'ACTIVE' as any, authority: authority as any, confidence: confidence as any }
      });
    }
    // IT: Claim-level fields are the current assessment; evidence history retains each source-specific assessment.
    await prisma.knowledgeClaim.updateMany({
      where: { id: existing.id, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
      data: { authority: authority as any, confidence: confidence as any }
    });
    return { claimId: existing.id, created: false, evidenceAdded: !priorEvidence, evidenceRestored: Boolean(priorEvidence && priorEvidence.status !== 'ACTIVE') };
  }

  const created = await prisma.knowledgeClaim.create({
    data: {
      userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId,
      kind: kind as any,
      status: 'ACTIVE' as any,
      statementEnc: encrypt(statement, 'knowledge.claim_statement'),
      statementIdx,
      authority: authority as any,
      confidence: confidence as any,
      ...subject,
      evidence: {
        create: {
          userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId,
          sourceInteractionId: interaction.id,
          sourceType: 'INTERACTION' as any,
          authority: authority as any,
          confidence: confidence as any,
          noteEnc: evidenceNote ? encrypt(evidenceNote, 'knowledge.evidence_note') : null,
          observedAt: interaction.occurredAt
        }
      }
    },
    select: { id: true }
  });

  return { claimId: created.id, created: true, evidenceAdded: true, evidenceRestored: false };
}

// IT: Workspace convenience seam. The data model still keeps Interaction, Claim/Evidence and
// the structured record distinct, but a human can create them with one reviewed action.
export async function captureAndPromoteKnowledgeFromInteraction(params: {
  context: CoreAccessContext;
  interactionId: string;
  kind: FormDataEntryValue | string | null | undefined;
  statement: string;
  authority: FormDataEntryValue | string | null | undefined;
  confidence: FormDataEntryValue | string | null | undefined;
  evidenceNote?: string | null;
}) {
  const kind = normaliseKnowledgeClaimKind(params.kind);
  const captured = await captureKnowledgeFromInteraction({ ...params, kind });
  if (!['OBJECTIVE', 'WANT', 'OFFER'].includes(kind)) return { ...captured, target: null };
  const promoted = await promoteKnowledgeClaim({
    context: params.context,
    claimId: captured.claimId,
    target: kind as 'OBJECTIVE' | 'WANT' | 'OFFER'
  });
  return { ...captured, target: { type: kind, ...promoted } };
}

async function loadClaimForPromotion(context: CoreAccessContext, claimId: string) {
  const row = await prisma.knowledgeClaim.findFirst({
    where: { id: claimId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, status: 'ACTIVE' as any },
    select: {
      id: true,
      kind: true,
      statementEnc: true,
      authority: true,
      confidence: true,
      contactId: true,
      personId: true,
      companyId: true,
      objectiveId: true,
      wantId: true,
      offerId: true,
      evidence: {
        where: { sourceInteractionId: { not: null } },
        select: { sourceInteractionId: true },
        orderBy: { observedAt: 'desc' },
        take: 1
      }
    }
  });
  if (!row) throw new Error('Active knowledge claim not found in this workspace.');
  return { ...row, statement: safeDecrypt(row.statementEnc, 'knowledge.claim_statement') };
}

export async function promoteKnowledgeClaim(params: {
  context: CoreAccessContext;
  claimId: string;
  target: 'OBJECTIVE' | 'WANT' | 'OFFER';
  title?: string | null;
}) {
  const claim = await loadClaimForPromotion(params.context, params.claimId);
  if (claim.kind !== params.target) throw new Error(`Only ${params.target.toLowerCase()} claims can be promoted to ${params.target.toLowerCase()}.`);
  const title = String(params.title || '').trim() || titleFromStatement(claim.statement);
  if (!title) throw new Error('A structured title is required.');
  const sourceInteractionId = claim.evidence[0]?.sourceInteractionId || null;

  if (params.target === 'OBJECTIVE') {
    if (claim.objectiveId) return { targetId: claim.objectiveId, created: false };
    const objective = await prisma.objective.create({
      data: {
        userId: params.context.workspaceUserId, contextSpaceId: params.context.contextSpaceId,
        status: 'CAPTURED' as any,
        titleEnc: encrypt(title, 'objective.title'),
        descriptionEnc: claim.statement ? encrypt(claim.statement, 'objective.description') : null,
        importance: 3,
        confidence: claim.confidence as any,
        authority: claim.authority as any,
        sourceType: sourceInteractionId ? ('INTERACTION' as any) : ('SYSTEM' as any),
        sourceInteractionId,
        contactId: claim.contactId,
        personId: claim.personId,
        companyId: claim.companyId
      },
      select: { id: true }
    });
    await prisma.knowledgeClaim.updateMany({
      where: { id: claim.id, userId: params.context.workspaceUserId, contextSpaceId: params.context.contextSpaceId },
      data: { objectiveId: objective.id }
    });
    return { targetId: objective.id, created: true };
  }

  const form = new FormData();
  form.set('title', title);
  form.set('description', claim.statement);
  form.set('status', 'CAPTURED');
  form.set('importance', '3');
  form.set('confidence', String(claim.confidence));
  form.set('authority', String(claim.authority));
  form.set('sourceType', sourceInteractionId ? 'INTERACTION' : 'SYSTEM');
  if (sourceInteractionId) form.set('sourceInteractionId', sourceInteractionId);

  if (params.target === 'WANT') {
    if (claim.wantId) return { targetId: claim.wantId, created: false };
    const created = await createWantFromForm({
      userId: params.context.workspaceUserId, contextSpaceId: params.context.contextSpaceId,
      form,
      links: { contactId: claim.contactId, personId: claim.personId, companyId: claim.companyId }
    });
    await prisma.knowledgeClaim.updateMany({ where: { id: claim.id, userId: params.context.workspaceUserId, contextSpaceId: params.context.contextSpaceId }, data: { wantId: created.id } });
    return { targetId: created.id, created: true };
  }

  if (claim.offerId) return { targetId: claim.offerId, created: false };
  const created = await createOfferFromForm({
    userId: params.context.workspaceUserId, contextSpaceId: params.context.contextSpaceId,
    form,
    links: { contactId: claim.contactId, personId: claim.personId, companyId: claim.companyId }
  });
  await prisma.knowledgeClaim.updateMany({ where: { id: claim.id, userId: params.context.workspaceUserId, contextSpaceId: params.context.contextSpaceId }, data: { offerId: created.id } });
  return { targetId: created.id, created: true };
}

export async function setKnowledgeClaimStatus(context: CoreAccessContext, claimId: string, status: 'ACTIVE' | 'SUPERSEDED' | 'REJECTED') {
  const result = await prisma.knowledgeClaim.updateMany({
    where: { id: claimId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    data: { status: status as any }
  });
  if (result.count === 0) throw new Error('Knowledge claim not found in this workspace.');
}

export async function setKnowledgeEvidenceStatus(
  context: CoreAccessContext,
  claimId: string,
  evidenceId: string,
  status: 'ACTIVE' | 'SUPERSEDED' | 'REJECTED'
) {
  // IT: Evidence status is independent of Claim status. Removing the last active evidence
  // deliberately does not silently retire the Claim; the UI surfaces the unsupported state.
  const result = await prisma.knowledgeEvidence.updateMany({
    where: { id: evidenceId, claimId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    data: { status: status as any }
  });
  if (result.count === 0) throw new Error('Knowledge evidence not found in this workspace.');
}

function mapStructuredTarget(row: any) {
  if (row.objective) return { type: 'OBJECTIVE', id: row.objective.id, title: safeDecrypt(row.objective.titleEnc, 'objective.title') };
  if (row.want) return { type: 'WANT', id: row.want.id, title: safeDecrypt(row.want.titleEnc, 'want.title') };
  if (row.offer) return { type: 'OFFER', id: row.offer.id, title: safeDecrypt(row.offer.titleEnc, 'offer.title') };
  return null;
}

async function mapClaim(row: any) {
  return {
    id: row.id,
    kind: row.kind,
    kindLabel: knowledgeClaimKindLabel(row.kind),
    status: row.status,
    statusLabel: knowledgeClaimStatusLabel(row.status),
    statement: safeDecrypt(row.statementEnc, 'knowledge.claim_statement'),
    authority: row.authority,
    authorityLabel: knowledgeAuthorityLabel(row.authority),
    confidence: row.confidence,
    confidenceLabel: knowledgeConfidenceLabel(row.confidence),
    evidenceCount: row.evidence?.length ?? row._count?.evidence ?? 0,
    activeEvidenceCount: row.evidence ? row.evidence.filter((item: any) => item.status === 'ACTIVE').length : (row._count?.activeEvidence ?? 0),
    hasActiveEvidence: row.evidence ? row.evidence.some((item: any) => item.status === 'ACTIVE') : ((row._count?.activeEvidence ?? 0) > 0),
    target: mapStructuredTarget(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

const claimSelect = {
  id: true,
  kind: true,
  status: true,
  statementEnc: true,
  authority: true,
  confidence: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { evidence: true } },
  evidence: { select: { status: true } },
  objective: { select: { id: true, titleEnc: true } },
  want: { select: { id: true, titleEnc: true } },
  offer: { select: { id: true, titleEnc: true } }
} as const;

export async function loadClaimsForInteraction(context: CoreAccessContext, interactionId: string) {
  const evidence = await prisma.knowledgeEvidence.findMany({
    where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, sourceInteractionId: interactionId },
    select: { claim: { select: claimSelect } },
    orderBy: { observedAt: 'desc' }
  });
  return Promise.all(evidence.map((row: any) => mapClaim(row.claim)));
}

export async function loadContactKnowledge(context: CoreAccessContext, contactId: string, take = 20) {
  const rows = await prisma.knowledgeClaim.findMany({
    where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId, status: 'ACTIVE' as any },
    select: claimSelect,
    orderBy: { updatedAt: 'desc' },
    take
  });
  return Promise.all(rows.map(mapClaim));
}

export async function loadContactKnowledgeHistory(context: CoreAccessContext, contactId: string, take = 20) {
  const rows = await prisma.knowledgeClaim.findMany({
    where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId, status: { not: 'ACTIVE' as any } },
    select: claimSelect,
    orderBy: { updatedAt: 'desc' },
    take
  });
  return Promise.all(rows.map(mapClaim));
}

export async function loadContactObjectives(context: CoreAccessContext, contactId: string, take = 20) {
  const rows = await prisma.objective.findMany({
    where: { userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId, contactId, status: { not: 'ARCHIVED' as any } },
    select: {
      id: true,
      status: true,
      titleEnc: true,
      descriptionEnc: true,
      importance: true,
      confidence: true,
      authority: true,
      sourceType: true,
      sourceInteractionId: true,
      updatedAt: true,
      knowledgeClaims: { select: { id: true, status: true, evidence: { select: { status: true } } } }
    },
    orderBy: { updatedAt: 'desc' },
    take
  });
  return rows.map((row: any) => ({
    id: row.id,
    status: row.status,
    statusLabel: objectiveStatusLabel(row.status),
    title: safeDecrypt(row.titleEnc, 'objective.title'),
    description: safeDecrypt(row.descriptionEnc, 'objective.description'),
    importance: row.importance,
    importanceLabel: importanceLabel(row.importance),
    confidence: row.confidence,
    confidenceLabel: objectiveConfidenceLabel(row.confidence),
    authority: row.authority,
    authorityLabel: knowledgeAuthorityLabel(row.authority),
    sourceType: row.sourceType,
    sourceTypeLabel: knowledgeSourceTypeLabel(row.sourceType),
    sourceInteractionId: row.sourceInteractionId,
    claimCount: row.knowledgeClaims?.length || 0,
    activeClaimCount: row.knowledgeClaims?.filter((claim: any) => claim.status === 'ACTIVE').length || 0,
    activeSupportedClaimCount: row.knowledgeClaims?.filter((claim: any) => claim.status === 'ACTIVE' && claim.evidence?.some((e: any) => e.status === 'ACTIVE')).length || 0,
    updatedAt: row.updatedAt
  }));
}

export async function loadObjective(context: CoreAccessContext, objectiveId: string) {
  const row = await prisma.objective.findFirst({
    where: { id: objectiveId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    select: {
      id: true,
      status: true,
      titleEnc: true,
      descriptionEnc: true,
      importance: true,
      confidence: true,
      authority: true,
      sourceType: true,
      sourceInteractionId: true,
      sourceNoteEnc: true,
      confirmedAt: true,
      contactId: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
      contact: { select: { id: true, fullNameEnc: true } },
      company: { select: { id: true, nameEnc: true } },
      knowledgeClaims: {
        select: {
          id: true, kind: true, status: true, statementEnc: true, authority: true, confidence: true,
          evidence: { select: { status: true } }
        },
        orderBy: { updatedAt: 'desc' }
      }
    }
  });
  if (!row) return null;
  return {
    ...row,
    title: safeDecrypt(row.titleEnc, 'objective.title'),
    description: safeDecrypt(row.descriptionEnc, 'objective.description'),
    sourceNote: safeDecrypt(row.sourceNoteEnc, 'objective.source_note'),
    statusLabel: objectiveStatusLabel(row.status),
    confidenceLabel: objectiveConfidenceLabel(row.confidence),
    authorityLabel: knowledgeAuthorityLabel(row.authority),
    sourceTypeLabel: knowledgeSourceTypeLabel(row.sourceType),
    contactName: row.contact ? safeDecrypt(row.contact.fullNameEnc, 'contact.full_name') : '',
    companyName: row.company ? safeDecrypt(row.company.nameEnc, 'company.name') : '',
    claimCount: row.knowledgeClaims?.length || 0,
    activeClaimCount: row.knowledgeClaims?.filter((claim: any) => claim.status === 'ACTIVE').length || 0,
    activeSupportedClaimCount: row.knowledgeClaims?.filter((claim: any) => claim.status === 'ACTIVE' && claim.evidence?.some((e: any) => e.status === 'ACTIVE')).length || 0,
    claims: (row.knowledgeClaims || []).map((claim: any) => ({
      id: claim.id,
      kind: claim.kind,
      kindLabel: knowledgeClaimKindLabel(claim.kind),
      status: claim.status,
      statusLabel: knowledgeClaimStatusLabel(claim.status),
      statement: safeDecrypt(claim.statementEnc, 'knowledge.claim_statement'),
      authorityLabel: knowledgeAuthorityLabel(claim.authority),
      confidenceLabel: knowledgeConfidenceLabel(claim.confidence),
      hasActiveEvidence: claim.evidence?.some((e: any) => e.status === 'ACTIVE') || false
    }))
  };
}

export async function loadKnowledgeClaim(context: CoreAccessContext, claimId: string) {
  const row = await prisma.knowledgeClaim.findFirst({
    where: { id: claimId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    select: {
      ...claimSelect,
      contactId: true,
      personId: true,
      companyId: true,
      contact: { select: { id: true, fullNameEnc: true } },
      company: { select: { id: true, nameEnc: true } },
      evidence: {
        select: {
          id: true, status: true, sourceType: true, authority: true, confidence: true, noteEnc: true, observedAt: true, createdAt: true,
          sourceInteraction: { select: { id: true, contactId: true, occurredAt: true, channel: true, sourceType: true } }
        },
        orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }]
      }
    }
  });
  if (!row) return null;
  const mapped = await mapClaim(row);
  const evidence = row.evidence.map((item: any) => ({
    id: item.id,
    status: item.status,
    statusLabel: knowledgeClaimStatusLabel(item.status),
    sourceType: item.sourceType,
    sourceTypeLabel: knowledgeSourceTypeLabel(item.sourceType),
    authority: item.authority,
    authorityLabel: knowledgeAuthorityLabel(item.authority),
    confidence: item.confidence,
    confidenceLabel: knowledgeConfidenceLabel(item.confidence),
    note: safeDecrypt(item.noteEnc, 'knowledge.evidence_note'),
    observedAt: item.observedAt,
    createdAt: item.createdAt,
    sourceInteraction: item.sourceInteraction
  }));
  return {
    ...mapped,
    contactId: row.contactId,
    personId: row.personId,
    companyId: row.companyId,
    contactName: row.contact ? safeDecrypt(row.contact.fullNameEnc, 'contact.full_name') : '',
    companyName: row.company ? safeDecrypt(row.company.nameEnc, 'company.name') : '',
    evidence,
    evidenceCount: evidence.length,
    activeEvidenceCount: evidence.filter((item: any) => item.status === 'ACTIVE').length,
    hasActiveEvidence: evidence.some((item: any) => item.status === 'ACTIVE')
  };
}

export async function updateObjectiveFromForm(context: CoreAccessContext, objectiveId: string, form: FormData) {
  const existing = await prisma.objective.findFirst({ where: { id: objectiveId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId }, select: { id: true } });
  if (!existing) throw new Error('Objective not found in this workspace.');
  const title = String(form.get('title') || '').trim();
  if (!title) throw new Error('Objective title is required.');
  const description = String(form.get('description') || '').trim();
  const statusRaw = String(form.get('status') || 'CAPTURED').trim().toUpperCase();
  const allowed = new Set(['CAPTURED','CLARIFYING','ACTIVE','PAUSED','FULFILLED','WITHDRAWN','EXPIRED','ARCHIVED']);
  const status = allowed.has(statusRaw) ? statusRaw : 'CAPTURED';
  const importance = Math.max(1, Math.min(5, Math.round(Number(form.get('importance') || 3))));
  await prisma.objective.updateMany({
    where: { id: objectiveId, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId },
    data: {
      titleEnc: encrypt(title, 'objective.title'),
      descriptionEnc: description ? encrypt(description, 'objective.description') : null,
      status: status as any,
      importance
    }
  });
}

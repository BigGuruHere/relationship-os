// src/lib/server/core/agentMemory.ts
// PURPOSE: Stage 8.5 derived, purpose-scoped agent memory projection.
// IMPORTANT: This is rebuilt from canonical Core records. It is not a second memory database or source of truth.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { safeDecryptCompany } from '$lib/companies';
import { safeDecryptIntent } from '$lib/server/intentCommon';
import { knowledgeAuthorityLabel } from '$lib/provenance';
import { knowledgeClaimKindLabel, knowledgeConfidenceLabel } from '$lib/knowledge';
import { objectiveStatusLabel } from '$lib/objectives';
import { wantStatusLabel, wantTypeLabel } from '$lib/wants';
import { offerDirectionLabel, offerStatusLabel, offerTypeLabel } from '$lib/offers';
import type { CoreAccessContext } from '$lib/server/core/accessPolicy';
import { findAccessibleCorePerson, findCoreContact } from '$lib/server/core/relationshipRepository';
import {
  assertAgentMayReadEntity,
  loadAgentAccessProfile,
  type AgentDataAccessPolicySnapshot,
  type AgentProfileSnapshot
} from '$lib/server/core/agentDataAccess';

export type AgentMemorySubjectType = 'contact' | 'person';

export type AgentMemoryProjection = {
  projectionVersion: 1;
  generatedAt: string;
  sourceOfTruth: 'RELISH_CORE';
  persisted: false;
  agent: AgentProfileSnapshot;
  policy: {
    scopeKey: string;
    purposeKey: string;
    deploymentScope: string;
    authorityLevel: string;
  };
  subject: {
    type: AgentMemorySubjectType;
    id: string;
    personId: string | null;
    contactIds: string[];
  };
  identity?: Record<string, unknown>;
  contactMethods?: Record<string, unknown>;
  relationships?: unknown[];
  recentInteractions?: unknown[];
  knowledgeClaims?: unknown[];
  objectives?: unknown[];
  wants?: unknown[];
  offers?: unknown[];
  introductions?: unknown[];
  memorySummary: string;
};

function safeDecrypt(payload: string | null | undefined, aad: string) {
  if (!payload) return '';
  try { return decrypt(payload, aad); } catch { return ''; }
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function compact(value: string | null | undefined, max = 900) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
}

function clampLimit(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.round(value)));
}

async function resolveSubject(
  context: CoreAccessContext,
  subjectType: AgentMemorySubjectType,
  subjectId: string,
  policy: AgentDataAccessPolicySnapshot
) {
  if (!subjectId) throw new Error('Missing memory subject id.');

  // IT: Build the Contact select from the data policy so denied fields are not queried/decrypted
  // in the new memory path. Identity and contact methods remain separate permissions.
  const contactSelect: any = { id: true, personId: true, linkedUserId: true, updatedAt: true };
  if (policy.allowIdentity) {
    Object.assign(contactSelect, {
      fullNameEnc: true, companyEnc: true, positionEnc: true,
      usualCommunicationMethod: true, lastContactedAt: true
    });
  }
  if (policy.allowContactMethods) {
    Object.assign(contactSelect, { emailEnc: true, phoneEnc: true, linkedinEnc: true });
  }

  if (subjectType === 'contact') {
    const contact = await findCoreContact(context, subjectId, contactSelect);
    if (!contact) throw new Error('Contact memory subject not found in this workspace.');
    return { personId: contact.personId, contacts: [contact] };
  }

  const person = await findAccessibleCorePerson(context, subjectId, {
    id: true,
    contacts: {
      where: { userId: context.workspaceUserId },
      select: contactSelect,
      orderBy: { updatedAt: 'desc' },
      take: 10
    }
  });
  if (!person) throw new Error('Person memory subject is not accessible from this workspace.');
  return { personId: person.id, contacts: person.contacts };
}

function subjectOrWhere(contactIds: string[], personId: string | null) {
  const OR: any[] = [];
  if (contactIds.length) OR.push({ contactId: { in: contactIds } });
  if (personId) OR.push({ personId });
  return OR.length ? { OR } : { id: '__no_subject__' };
}

function identityProjection(contacts: any[]) {
  if (!contacts.length) return { displayName: '', representations: [] };
  return {
    displayName: '',
    representations: contacts.map((contact) => ({
      contactId: contact.id,
      name: safeDecrypt(contact.fullNameEnc, 'contact.full_name'),
      company: safeDecrypt(contact.companyEnc, 'contact.company'),
      position: safeDecrypt(contact.positionEnc, 'contact.position'),
      usualCommunicationMethod: contact.usualCommunicationMethod,
      lastContactedAt: iso(contact.lastContactedAt)
    }))
  };
}

function contactMethodsProjection(contacts: any[]) {
  return {
    representations: contacts.map((contact) => ({
      contactId: contact.id,
      email: safeDecrypt(contact.emailEnc, 'contact.email'),
      phone: safeDecrypt(contact.phoneEnc, 'contact.phone'),
      linkedin: safeDecrypt(contact.linkedinEnc, 'contact.linkedin')
    }))
  };
}

async function loadRelationships(userId: string, contactIds: string[]) {
  if (!contactIds.length) return [];
  const rows = await prisma.contactRelationship.findMany({
    where: {
      userId,
      OR: [{ contactAId: { in: contactIds } }, { contactBId: { in: contactIds } }]
    },
    select: {
      id: true,
      relationshipType: true,
      label: true,
      isDirectional: true,
      contactAId: true,
      contactBId: true,
      contactA: { select: { id: true, fullNameEnc: true } },
      contactB: { select: { id: true, fullNameEnc: true } }
    },
    orderBy: { updatedAt: 'desc' },
    take: 40
  });
  const subjectIds = new Set(contactIds);
  return rows.map((row: any) => {
    const other = subjectIds.has(row.contactAId) ? row.contactB : row.contactA;
    return {
      id: row.id,
      type: row.relationshipType,
      label: row.label,
      directional: row.isDirectional,
      otherContactId: other.id,
      otherName: safeDecrypt(other.fullNameEnc, 'contact.full_name')
    };
  });
}

async function loadInteractions(userId: string, contactIds: string[], personId: string | null, policy: AgentDataAccessPolicySnapshot) {
  const where = subjectOrWhere(contactIds, personId);
  const rows = await prisma.interaction.findMany({
    where: { userId, ...where },
    select: { id: true, channel: true, sourceType: true, occurredAt: true, summaryEnc: true, rawTextEnc: true },
    orderBy: { occurredAt: 'desc' },
    take: clampLimit(policy.maxRecentInteractions, 8, 25)
  });
  return rows.map((row: any) => ({
    id: row.id,
    channel: row.channel,
    sourceType: row.sourceType,
    occurredAt: iso(row.occurredAt),
    summary: compact(safeDecrypt(row.summaryEnc, 'interaction.summary') || safeDecrypt(row.rawTextEnc, 'interaction.raw_text'))
  }));
}

async function loadClaims(userId: string, contactIds: string[], personId: string | null, policy: AgentDataAccessPolicySnapshot) {
  const where = subjectOrWhere(contactIds, personId);
  const rows = await prisma.knowledgeClaim.findMany({
    where: { userId, status: 'ACTIVE' as any, ...where },
    select: {
      id: true,
      kind: true,
      statementEnc: true,
      authority: true,
      confidence: true,
      updatedAt: true,
      evidence: { select: { status: true } }
    },
    orderBy: { updatedAt: 'desc' },
    take: clampLimit(policy.maxKnowledgeClaims, 20, 50)
  });
  return rows.map((row: any) => ({
    id: row.id,
    kind: row.kind,
    kindLabel: knowledgeClaimKindLabel(row.kind),
    statement: compact(safeDecrypt(row.statementEnc, 'knowledge.claim_statement'), 1200),
    authority: row.authority,
    authorityLabel: knowledgeAuthorityLabel(row.authority),
    confidence: row.confidence,
    confidenceLabel: knowledgeConfidenceLabel(row.confidence),
    hasActiveEvidence: row.evidence.some((e: any) => e.status === 'ACTIVE'),
    updatedAt: iso(row.updatedAt)
  }));
}

async function loadObjectives(userId: string, contactIds: string[], personId: string | null, policy: AgentDataAccessPolicySnapshot) {
  const where = subjectOrWhere(contactIds, personId);
  const rows = await prisma.objective.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any }, ...where },
    select: { id: true, status: true, titleEnc: true, descriptionEnc: true, importance: true, confidence: true, authority: true, updatedAt: true },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: clampLimit(policy.maxObjectives, 12, 30)
  });
  return rows.map((row: any) => ({
    id: row.id,
    status: row.status,
    statusLabel: objectiveStatusLabel(row.status),
    title: compact(safeDecrypt(row.titleEnc, 'objective.title'), 300),
    description: compact(safeDecrypt(row.descriptionEnc, 'objective.description'), 900),
    importance: row.importance,
    confidence: row.confidence,
    authority: row.authority,
    updatedAt: iso(row.updatedAt)
  }));
}

async function loadWantsForMemory(userId: string, contactIds: string[], personId: string | null, policy: AgentDataAccessPolicySnapshot) {
  const where = subjectOrWhere(contactIds, personId);
  const rows = await prisma.want.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any }, ...where },
    select: {
      id: true, wantType: true, status: true, titleEnc: true, descriptionEnc: true, summaryEnc: true, criteriaEnc: true,
      categoryEnc: true, geographyEnc: true, importance: true, urgency: true, timeHorizon: true, confidence: true, authority: true,
      valueMinCents: true, valueMaxCents: true, currency: true, updatedAt: true
    },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: clampLimit(policy.maxWants, 12, 30)
  });
  return rows.map((row: any) => ({
    id: row.id,
    type: row.wantType,
    typeLabel: wantTypeLabel(row.wantType),
    status: row.status,
    statusLabel: wantStatusLabel(row.status),
    title: compact(safeDecryptIntent(row.titleEnc, 'want.title', ''), 300),
    description: compact(safeDecryptIntent(row.descriptionEnc, 'want.description', ''), 800),
    summary: compact(safeDecryptIntent(row.summaryEnc, 'want.summary', ''), 600),
    criteria: compact(safeDecryptIntent(row.criteriaEnc, 'want.criteria', ''), 800),
    category: compact(safeDecryptIntent(row.categoryEnc, 'want.category', ''), 200),
    geography: compact(safeDecryptIntent(row.geographyEnc, 'want.geography', ''), 200),
    importance: row.importance,
    urgency: row.urgency,
    timeHorizon: row.timeHorizon,
    confidence: row.confidence,
    authority: row.authority,
    valueMinCents: row.valueMinCents?.toString() ?? null,
    valueMaxCents: row.valueMaxCents?.toString() ?? null,
    currency: row.currency,
    updatedAt: iso(row.updatedAt)
  }));
}

async function loadOffersForMemory(userId: string, contactIds: string[], personId: string | null, policy: AgentDataAccessPolicySnapshot) {
  const where = subjectOrWhere(contactIds, personId);
  const rows = await prisma.offer.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any }, ...where },
    select: {
      id: true, offerType: true, direction: true, status: true, titleEnc: true, descriptionEnc: true, summaryEnc: true, termsEnc: true,
      categoryEnc: true, geographyEnc: true, importance: true, urgency: true, timeHorizon: true, confidence: true, authority: true,
      valueMinCents: true, valueMaxCents: true, currency: true, updatedAt: true
    },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: clampLimit(policy.maxOffers, 12, 30)
  });
  return rows.map((row: any) => ({
    id: row.id,
    type: row.offerType,
    typeLabel: offerTypeLabel(row.offerType),
    direction: row.direction,
    directionLabel: offerDirectionLabel(row.direction),
    status: row.status,
    statusLabel: offerStatusLabel(row.status),
    title: compact(safeDecryptIntent(row.titleEnc, 'offer.title', ''), 300),
    description: compact(safeDecryptIntent(row.descriptionEnc, 'offer.description', ''), 800),
    summary: compact(safeDecryptIntent(row.summaryEnc, 'offer.summary', ''), 600),
    terms: compact(safeDecryptIntent(row.termsEnc, 'offer.terms', ''), 800),
    category: compact(safeDecryptIntent(row.categoryEnc, 'offer.category', ''), 200),
    geography: compact(safeDecryptIntent(row.geographyEnc, 'offer.geography', ''), 200),
    importance: row.importance,
    urgency: row.urgency,
    timeHorizon: row.timeHorizon,
    confidence: row.confidence,
    authority: row.authority,
    valueMinCents: row.valueMinCents?.toString() ?? null,
    valueMaxCents: row.valueMaxCents?.toString() ?? null,
    currency: row.currency,
    updatedAt: iso(row.updatedAt)
  }));
}

async function loadIntroductions(userId: string, contactIds: string[], policy: AgentDataAccessPolicySnapshot) {
  if (!contactIds.length) return [];
  const rows = await prisma.introductionParticipant.findMany({
    where: { userId, contactId: { in: contactIds } },
    select: {
      introduction: {
        select: {
          id: true,
          status: true,
          occurredAt: true,
          reasonEnc: true,
          participants: {
            select: {
              side: true,
              contactId: true,
              companyId: true,
              contact: { select: { id: true, fullNameEnc: true } },
              company: { select: { id: true, nameEnc: true } }
            }
          },
          outcomes: policy.allowOutcomes ? {
            select: { id: true, status: true, commerciality: true, useful: true, continued: true, resultEnc: true, occurredAt: true },
            orderBy: { occurredAt: 'desc' },
            take: 5
          } : false
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  const seen = new Set<string>();
  const output: any[] = [];
  for (const row of rows as any[]) {
    const intro = row.introduction;
    if (seen.has(intro.id)) continue;
    seen.add(intro.id);
    output.push({
      id: intro.id,
      status: intro.status,
      occurredAt: iso(intro.occurredAt),
      reason: compact(safeDecrypt(intro.reasonEnc, 'introduction.reason'), 600),
      participants: intro.participants.map((p: any) => ({
        side: p.side,
        contactId: p.contactId,
        contactName: p.contact ? safeDecrypt(p.contact.fullNameEnc, 'contact.full_name') : '',
        companyId: p.companyId,
        companyName: p.company ? safeDecryptCompany(p.company.nameEnc, 'company.name', '') : ''
      })),
      ...(policy.allowOutcomes ? {
        outcomes: (intro.outcomes || []).map((outcome: any) => ({
          id: outcome.id,
          status: outcome.status,
          commerciality: outcome.commerciality,
          useful: outcome.useful,
          continued: outcome.continued,
          result: compact(safeDecrypt(outcome.resultEnc, 'outcome.result'), 600),
          occurredAt: iso(outcome.occurredAt)
        }))
      } : {})
    });
  }
  return output;
}

function buildMemorySummary(projection: Omit<AgentMemoryProjection, 'memorySummary'>) {
  const lines: string[] = [];
  const identity: any = projection.identity;
  const name = identity?.representations?.[0]?.name || '';
  if (name) lines.push(`Subject: ${name}`);
  for (const objective of (projection.objectives || []) as any[]) lines.push(`Objective: ${objective.title}`);
  for (const want of (projection.wants || []) as any[]) lines.push(`Want: ${want.title}`);
  for (const offer of (projection.offers || []) as any[]) lines.push(`Offer: ${offer.title}`);
  for (const claim of ((projection.knowledgeClaims || []) as any[]).slice(0, 8)) lines.push(`${claim.kindLabel}: ${claim.statement}${claim.hasActiveEvidence ? '' : ' [no active evidence]'}`);
  for (const interaction of ((projection.recentInteractions || []) as any[]).slice(0, 4)) lines.push(`Recent interaction: ${interaction.summary}`);
  if (!lines.length) lines.push('No permitted relationship memory is available for this subject.');
  return lines.join('\n').slice(0, 12000);
}

export async function buildAgentMemoryProjection(params: {
  context: CoreAccessContext;
  subjectType: AgentMemorySubjectType;
  subjectId: string;
}): Promise<AgentMemoryProjection> {
  const { agent, policy } = await loadAgentAccessProfile(params.context);
  assertAgentMayReadEntity(policy, params.subjectType);

  const resolved = await resolveSubject(params.context, params.subjectType, params.subjectId, policy);
  const contactIds = resolved.contacts.map((contact: any) => contact.id);
  const personId = resolved.personId;

  const projectionBase: Omit<AgentMemoryProjection, 'memorySummary'> = {
    projectionVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceOfTruth: 'RELISH_CORE',
    persisted: false,
    agent,
    policy: {
      scopeKey: policy.scopeKey,
      purposeKey: agent.purposeKey,
      deploymentScope: agent.deploymentScope,
      authorityLevel: agent.authorityLevel
    },
    subject: {
      type: params.subjectType,
      id: params.subjectId,
      personId,
      contactIds
    },
    ...(policy.allowIdentity ? { identity: identityProjection(resolved.contacts) } : {}),
    ...(policy.allowContactMethods ? { contactMethods: contactMethodsProjection(resolved.contacts) } : {}),
    ...(policy.allowRelationships ? { relationships: await loadRelationships(params.context.workspaceUserId, contactIds) } : {}),
    ...(policy.allowInteractions ? { recentInteractions: await loadInteractions(params.context.workspaceUserId, contactIds, personId, policy) } : {}),
    ...(policy.allowKnowledgeClaims ? { knowledgeClaims: await loadClaims(params.context.workspaceUserId, contactIds, personId, policy) } : {}),
    ...(policy.allowObjectives ? { objectives: await loadObjectives(params.context.workspaceUserId, contactIds, personId, policy) } : {}),
    ...(policy.allowWants ? { wants: await loadWantsForMemory(params.context.workspaceUserId, contactIds, personId, policy) } : {}),
    ...(policy.allowOffers ? { offers: await loadOffersForMemory(params.context.workspaceUserId, contactIds, personId, policy) } : {}),
    ...(policy.allowIntroductions ? { introductions: await loadIntroductions(params.context.workspaceUserId, contactIds, policy) } : {})
  };

  // IT: Display name is intentionally derived from a workspace Contact representation, never Person global truth.
  if (projectionBase.identity && resolved.contacts[0]) {
    (projectionBase.identity as any).displayName = await contactDisplayName(resolved.contacts[0]);
  }

  return { ...projectionBase, memorySummary: buildMemorySummary(projectionBase) };
}

// PURPOSE: Stage 8.12.0 - a small, reviewable understanding of a Dating participant.
// SECURITY: This is an operator-held Dating account, NOT participant verification or permission to disclose.
// No global Person fields or cross-ContextSpace copies are created. Source and decisions are append-only Interactions.
import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import type { Prisma } from '@prisma/client';
import { shouldAppendUnderstandingReview } from './understandingReviewPolicy';
import { encrypt, decrypt, buildScopedIndexToken } from '$lib/crypto';

const CHANNEL = 'DATING_LIVING_UNDERSTANDING';
const AAD = 'interaction.raw_text';
export type UnderstandingDecision = 'CONFIRMED' | 'DEFERRED' | 'REJECTED';
export const DATING_KNOWLEDGE_KINDS = ['FACT', 'WANT', 'OFFER', 'PREFERENCE', 'CONSTRAINT', 'OBJECTIVE', 'OTHER'] as const;
export type DatingKnowledgeKind = typeof DATING_KNOWLEDGE_KINDS[number];
export function validateDatingKnowledgeKind(value: unknown): DatingKnowledgeKind {
  return DATING_KNOWLEDGE_KINDS.includes(value as DatingKnowledgeKind) ? value as DatingKnowledgeKind : 'OTHER';
}
type Entry = { version: 1; event: 'PROPOSE' | 'REVIEW'; proposalId: string; statement: string; decision?: UnderstandingDecision; note?: string; actor?: 'OPERATOR' | 'DORIAN' | 'PARTICIPANT'; kind?: DatingKnowledgeKind; sourceInteractionId?: string | null };
// Future Dorian and participant reviews must use authenticated actor provenance, not caller-supplied form fields.
type Tx = Prisma.TransactionClient;
type Scope = { userId: string; contextSpaceId: string; contactId: string };

export function validateUnderstandingStatement(value: unknown) {
  const statement = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!statement || statement.length > 600) throw new Error('Enter a statement of 1 to 600 characters.');
  return statement;
}
export function validateUnderstandingDecision(value: unknown): UnderstandingDecision {
  if (value === 'CONFIRMED' || value === 'DEFERRED' || value === 'REJECTED') return value;
  throw new Error('Choose Confirm, Not sure yet or Reject.');
}

async function requireOwnedDatingContact(scope: Scope) {
  // Always validate owner, custody AND contact identity before any read or mutation.
  const [space, contact] = await Promise.all([
    prisma.contextSpace.findFirst({ where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey: 'dating' }, select: { id: true } }),
    prisma.contact.findFirst({ where: { id: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, select: { id: true } })
  ]);
  if (!space || !contact) throw new Error('Dating participant not found in your active space.');
}


// The original reflection is checked at both proposal creation and review time.
// This avoids attaching one person's knowledge to somebody else's private experience.
export async function requireSourceReflection(scope: Scope, sourceId: string, tx: Pick<Prisma.TransactionClient, 'interaction'> = prisma) {
  const source = await tx.interaction.findFirst({ where: {
    id: sourceId, userId: scope.userId, contextSpaceId: scope.contextSpaceId,
    contactId: scope.contactId, channel: 'DATING_PERSON_REFLECTION'
  }, select: { id: true, rawTextEnc: true, occurredAt: true } });
  if (!source) throw new Error('The source reflection is not accessible for this person.');
  const payload = JSON.parse(decrypt(source.rawTextEnc, AAD)) as { version?: number; kind?: string; actor?: string; text?: string };
  if (payload.version !== 1 || payload.kind !== 'PERSONAL_REFLECTION' || payload.actor !== 'OPERATOR' || !payload.text) {
    throw new Error('The source is not a valid private reflection.');
  }
  return { id: source.id, text: payload.text, at: source.occurredAt };
}

// Current person-level view: reads active, context-scoped claims directly, not the historical transcript.
export async function listCurrentDatingKnowledge(scope: Scope) {
  await requireOwnedDatingContact(scope);
  const rows = await prisma.knowledgeClaim.findMany({ where: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId, status: 'ACTIVE'
  }, select: { id: true, kind: true, statementEnc: true, authority: true, confidence: true,
    updatedAt: true, evidence: { where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, status: 'ACTIVE' },
      select: { sourceInteractionId: true }, take: 8 } }, orderBy: { updatedAt: 'desc' }, take: 150 });
  return rows.map(row => ({ id: row.id, kind: row.kind, statement: decrypt(row.statementEnc, 'knowledge.claim_statement'),
    authority: row.authority, confidence: row.confidence, updatedAt: row.updatedAt,
    evidenceCount: row.evidence.length }));
}

// Create and initially review in ONE transaction so a failed confirmation never leaves a half-created item.
export async function createDatingUnderstanding(scope: Scope, input: { statement: string; note?: string; decision: string; kind?: string; sourceInteractionId?: string | null }) {
  await requireOwnedDatingContact(scope);
  const statement = validateUnderstandingStatement(input.statement);
  const decision = input.decision === 'PENDING' ? null : validateUnderstandingDecision(input.decision);
  const note = String(input.note ?? '').trim().slice(0, 1000);
  const proposalId = randomUUID();
  const kind = validateDatingKnowledgeKind(input.kind || 'PREFERENCE');
  // A source may be linked only if it is an owned, same-space reflection of this person.
  const sourceInteractionId = input.sourceInteractionId || null;
  if (sourceInteractionId) await requireSourceReflection(scope, sourceInteractionId);
  await prisma.$transaction(async (tx) => {
    const entry: Entry = { version: 1, event: 'PROPOSE', proposalId, statement, note, actor: 'OPERATOR', kind, sourceInteractionId };
    // The original is immutable even if the initial decision is confirmed immediately.
    await tx.interaction.create({ data: {
      userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
      channel: CHANNEL, sourceType: 'WORKSPACE', externalRef: `understanding:proposal:${proposalId}`,
      rawTextEnc: encrypt(JSON.stringify(entry), AAD)
    }});
    if (decision) await appendUnderstandingReview(tx, scope, { proposalId, statement, decision, note: '' });
  });
  return proposalId;
}

export async function listDatingUnderstanding(scope: Scope) {
  await requireOwnedDatingContact(scope);
  const rows = await prisma.interaction.findMany({
    where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId, channel: CHANNEL },
    select: { id: true, rawTextEnc: true, occurredAt: true }, orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 300
  });
  const proposals = new Map<string, { id: string; statement: string; proposalNote: string; proposedAt: Date; decision: UnderstandingDecision | null; reviewedStatement: string | null; reviewedAt: Date | null; kind: DatingKnowledgeKind; sourceInteractionId: string | null; history: { decision: UnderstandingDecision; statement: string; at: Date; note: string; actor: string }[] }>();
  for (const row of rows) {
    // Fail closed on malformed encrypted content rather than leaking another kind of Interaction.
    const entry = JSON.parse(decrypt(row.rawTextEnc, AAD)) as Entry;
    if (entry.version !== 1 || !entry.proposalId) continue;
    if (entry.event === 'PROPOSE') {
      proposals.set(entry.proposalId, { id: entry.proposalId, statement: entry.statement, proposalNote: entry.note ?? '', proposedAt: row.occurredAt, kind: validateDatingKnowledgeKind(entry.kind || 'PREFERENCE'), sourceInteractionId: entry.sourceInteractionId || null, decision: null, reviewedStatement: null, reviewedAt: null, history: [] });
    } else if (entry.event === 'REVIEW') {
      const proposal = proposals.get(entry.proposalId);
      if (!proposal || !entry.decision) continue;
      proposal.decision = entry.decision;
      proposal.reviewedStatement = entry.statement;
      proposal.reviewedAt = row.occurredAt;
      proposal.history.push({ decision: entry.decision, statement: entry.statement, at: row.occurredAt, note: entry.note ?? '', actor: entry.actor ?? 'OPERATOR' });
    }
  }
  return [...proposals.values()].reverse();
}

// The transactional row-independent lock serialises submissions for a single proposal.
// It prevents two concurrent unchanged confirmations from producing duplicate review events.
async function appendUnderstandingReview(tx: Tx, scope: Scope, input: { proposalId: string; statement: string; decision: UnderstandingDecision; note: string }) {
  const { proposalId, statement, decision, note } = input;
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${scope.contextSpaceId}), hashtext(${proposalId}))) AS lock_row`;
  const source = await tx.interaction.findFirst({ where: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
    channel: CHANNEL, externalRef: `understanding:proposal:${proposalId}`
  }, select: { id: true, rawTextEnc: true } });
  if (!source) throw new Error('Proposed understanding was not found in this Dating space.');
  const origin = JSON.parse(decrypt(source.rawTextEnc, AAD)) as Entry;
  if (origin.version !== 1 || origin.event !== 'PROPOSE' || origin.proposalId !== proposalId) throw new Error('Invalid knowledge proposal provenance.');
  const kind = validateDatingKnowledgeKind(origin.kind || 'PREFERENCE');
  if (origin.sourceInteractionId) await requireSourceReflection(scope, origin.sourceInteractionId, tx);

  const earlierReviews = await tx.interaction.findMany({ where: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
    channel: CHANNEL, externalRef: { startsWith: `understanding:review:${proposalId}:` }
  }, select: { id: true, rawTextEnc: true, occurredAt: true }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 300 });
  if (earlierReviews.length >= 300) throw new Error('Review history limit reached; stop and request support.');
  const previous = earlierReviews.map(row => ({ row, event: JSON.parse(decrypt(row.rawTextEnc, AAD)) as Entry }))
    .filter(({ event }) => event.version === 1 && event.event === 'REVIEW' && event.proposalId === proposalId);
  const last = previous[0]?.event;
  // A meaningful note may be added, but an unchanged repeat without a new note is a no-op.
  if (!shouldAppendUnderstandingReview(last ? { statement: last.statement, decision: last.decision ?? '', note: last.note } : null, { statement, decision, note })) return false;

  const event: Entry = { version: 1, event: 'REVIEW', proposalId, statement, decision, note, actor: 'OPERATOR' };
  const reviewEvent = await tx.interaction.create({ data: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
    channel: CHANNEL, sourceType: 'WORKSPACE', externalRef: `understanding:review:${proposalId}:${randomUUID()}`,
    rawTextEnc: encrypt(JSON.stringify(event), AAD)
  }, select: { id: true } });

  const earlierIds = previous.map(({ row }) => row.id);
  const priorEvidence = await tx.knowledgeEvidence.findMany({ where: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId,
    sourceInteractionId: { in: earlierIds }, status: 'ACTIVE'
  }, select: { id: true, claimId: true } });
  // Retire any original-reflection evidence associated with earlier reviews of this proposal.
  // Restrict by claim ID so a shared source cannot invalidate unrelated knowledge proposals.
  const originEvidence = origin.sourceInteractionId && priorEvidence.length ? await tx.knowledgeEvidence.findMany({ where: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, sourceInteractionId: origin.sourceInteractionId,
    claimId: { in: [...new Set(priorEvidence.map(e => e.claimId))] }, status: 'ACTIVE'
  }, select: { id: true, claimId: true } }) : [];
  const retiredEvidence = [...priorEvidence, ...originEvidence];
  for (const old of retiredEvidence) {
    await tx.knowledgeEvidence.updateMany({ where: { id: old.id, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, data: { status: 'SUPERSEDED' } });
    const remaining = await tx.knowledgeEvidence.count({ where: {
      claimId: old.claimId, userId: scope.userId, contextSpaceId: scope.contextSpaceId, status: 'ACTIVE'
    } });
    if (!remaining) await tx.knowledgeClaim.updateMany({ where: {
      id: old.claimId, userId: scope.userId, contextSpaceId: scope.contextSpaceId
    }, data: { status: 'SUPERSEDED' } });
  }
  if (decision !== 'CONFIRMED') return true;

  // Operator acceptance remains THIRD_PARTY_REPORTED. It does not grant participant authority or disclosure.
  const statementIdx = buildScopedIndexToken(statement, 'knowledge:claim:statement');
  const existing = await tx.knowledgeClaim.findFirst({ where: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
    kind, statementIdx, status: { in: ['ACTIVE', 'SUPERSEDED'] }
  }, select: { id: true } });
  if (existing) await tx.knowledgeClaim.updateMany({ where: {
    id: existing.id, userId: scope.userId, contextSpaceId: scope.contextSpaceId
  }, data: { status: 'ACTIVE' } });
  const claimId = existing?.id ?? (await tx.knowledgeClaim.create({ data: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
    kind, status: 'ACTIVE', statementEnc: encrypt(statement, 'knowledge.claim_statement'),
    statementIdx, authority: 'THIRD_PARTY_REPORTED', confidence: 'LOW'
  }, select: { id: true } })).id;
  await tx.knowledgeEvidence.create({ data: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, claimId,
    sourceInteractionId: reviewEvent.id, sourceType: 'INTERACTION',
    authority: 'THIRD_PARTY_REPORTED', confidence: 'LOW',
    noteEnc: encrypt('Dating operator-reviewed understanding; not participant verification or disclosure consent.', 'knowledge.evidence_note')
  }});
  // Link the originating reflection as separate evidence without changing its encrypted source.
  if (origin.sourceInteractionId) {
    const earlier = await tx.knowledgeEvidence.findFirst({ where: {
      userId: scope.userId, contextSpaceId: scope.contextSpaceId, claimId, sourceInteractionId: origin.sourceInteractionId
    }, select: { id: true } });
    if (earlier) await tx.knowledgeEvidence.updateMany({ where: { id: earlier.id, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, data: { status: 'ACTIVE' } });
    else await tx.knowledgeEvidence.create({ data: {
      userId: scope.userId, contextSpaceId: scope.contextSpaceId, claimId, sourceInteractionId: origin.sourceInteractionId,
      sourceType: 'INTERACTION', authority: 'THIRD_PARTY_REPORTED', confidence: 'LOW',
      noteEnc: encrypt('Original private reflection; not participant confirmation or permission to disclose.', 'knowledge.evidence_note')
    }});
  }
  return true;
}

export async function reviewDatingUnderstanding(scope: Scope, input: { proposalId: string; statement: string; decision: string; note?: string }) {
  await requireOwnedDatingContact(scope);
  const decision = validateUnderstandingDecision(input.decision);
  const statement = validateUnderstandingStatement(input.statement);
  const note = String(input.note ?? '').trim().slice(0, 1000);
  const proposalId = String(input.proposalId || '');
  if (!/^[0-9a-f-]{36}$/i.test(proposalId)) throw new Error('Invalid understanding identifier.');
  return prisma.$transaction((tx) => appendUnderstandingReview(tx, scope, { proposalId, statement, decision, note }));
}

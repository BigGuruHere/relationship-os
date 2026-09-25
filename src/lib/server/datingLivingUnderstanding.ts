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
type Entry = { version: 1; event: 'PROPOSE' | 'REVIEW'; proposalId: string; statement: string; decision?: UnderstandingDecision; note?: string; actor?: 'OPERATOR' | 'DORIAN' | 'PARTICIPANT' };
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

// Create and initially review in ONE transaction so a failed confirmation never leaves a half-created item.
export async function createDatingUnderstanding(scope: Scope, input: { statement: string; note?: string; decision: string }) {
  await requireOwnedDatingContact(scope);
  const statement = validateUnderstandingStatement(input.statement);
  const decision = input.decision === 'PENDING' ? null : validateUnderstandingDecision(input.decision);
  const note = String(input.note ?? '').trim().slice(0, 1000);
  const proposalId = randomUUID();
  await prisma.$transaction(async (tx) => {
    const entry: Entry = { version: 1, event: 'PROPOSE', proposalId, statement, note, actor: 'OPERATOR' };
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
  const proposals = new Map<string, { id: string; statement: string; proposalNote: string; proposedAt: Date; decision: UnderstandingDecision | null; reviewedStatement: string | null; reviewedAt: Date | null; history: { decision: UnderstandingDecision; statement: string; at: Date; note: string; actor: string }[] }>();
  for (const row of rows) {
    // Fail closed on malformed encrypted content rather than leaking another kind of Interaction.
    const entry = JSON.parse(decrypt(row.rawTextEnc, AAD)) as Entry;
    if (entry.version !== 1 || !entry.proposalId) continue;
    if (entry.event === 'PROPOSE') {
      proposals.set(entry.proposalId, { id: entry.proposalId, statement: entry.statement, proposalNote: entry.note ?? '', proposedAt: row.occurredAt, decision: null, reviewedStatement: null, reviewedAt: null, history: [] });
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
  }, select: { id: true } });
  if (!source) throw new Error('Proposed understanding was not found in this Dating space.');

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
  for (const old of priorEvidence) {
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
    kind: 'PREFERENCE', statementIdx, status: { in: ['ACTIVE', 'SUPERSEDED'] }
  }, select: { id: true } });
  if (existing) await tx.knowledgeClaim.updateMany({ where: {
    id: existing.id, userId: scope.userId, contextSpaceId: scope.contextSpaceId
  }, data: { status: 'ACTIVE' } });
  const claimId = existing?.id ?? (await tx.knowledgeClaim.create({ data: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
    kind: 'PREFERENCE', status: 'ACTIVE', statementEnc: encrypt(statement, 'knowledge.claim_statement'),
    statementIdx, authority: 'THIRD_PARTY_REPORTED', confidence: 'LOW'
  }, select: { id: true } })).id;
  await tx.knowledgeEvidence.create({ data: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, claimId,
    sourceInteractionId: reviewEvent.id, sourceType: 'INTERACTION',
    authority: 'THIRD_PARTY_REPORTED', confidence: 'LOW',
    noteEnc: encrypt('Dating operator-reviewed understanding; not participant verification or disclosure consent.', 'knowledge.evidence_note')
  }});
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

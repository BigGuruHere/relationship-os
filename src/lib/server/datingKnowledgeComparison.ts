// Stage 8.12.12: operator-controlled, same-person knowledge evolution.
// SECURITY: classifications are operator decisions, not model findings or participant consent.
// Original source reflections, review events and historical knowledge remain preserved.
import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt, decrypt } from '$lib/crypto';
import { requireDatingPerson, type Scope } from './datingUnderstandingTopics';
import { validateComparison, type ComparisonKind } from './datingKnowledgeComparisonPolicy';
export { sharedTopicCandidates } from './datingKnowledgeComparisonPolicy';

const CHANNEL = 'DATING_KNOWLEDGE_COMPARISON';
const AAD = 'interaction.raw_text';
export type ComparisonEntry = { version: 1; event: 'OPERATOR_COMPARE'; newerClaimId: string; olderClaimId: string; relationship: ComparisonKind; note: string; olderStatement: string; newerStatement: string; olderWasSuperseded: boolean; actor: 'OPERATOR' };

export async function compareDatingKnowledge(scope: Scope, raw: { newerClaimId: string; olderClaimId: string; relationship: string; note?: string; acknowledgeSupersession?: boolean }) {
  const input = validateComparison(raw);
  await requireDatingPerson(scope);
  return prisma.$transaction(async tx => {
    // Serialise concurrent submissions for this ordered pair and validate both sides inside the lock.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${scope.contextSpaceId}), hashtext(${input.newerClaimId + ':' + input.olderClaimId}))) AS lock_row`;
    const [newer, older] = await Promise.all([
      tx.knowledgeClaim.findFirst({ where: { id: input.newerClaimId, ...scope, status: 'ACTIVE' }, select: { id: true, statementEnc: true, createdAt: true } }),
      tx.knowledgeClaim.findFirst({ where: { id: input.olderClaimId, ...scope, status: 'ACTIVE' }, select: { id: true, statementEnc: true, createdAt: true } })
    ]);
    if (!newer || !older) throw new Error('Both statements must still be active and belong to the same person. Reload the page.');
    if (input.relationship === 'SUPERSEDES' && newer.createdAt < older.createdAt) throw new Error('The replacement was entered before the statement you are retiring. Swap their positions or keep both active.');
    const links = await tx.understandingTopicClaim.findMany({ where: { ...scope, claimId: { in: [newer.id, older.id] } }, select: { claimId: true, topicId: true } });
    const newerTopicIds = new Set(links.filter(link => link.claimId === newer.id).map(link => link.topicId));
    if (!links.some(link => link.claimId === older.id && newerTopicIds.has(link.topicId))) throw new Error('Assign both statements to at least one common topic before comparing them.');
    const externalPrefix = `knowledge:comparison:${input.newerClaimId}:${input.olderClaimId}:`;
    const prior = await tx.interaction.findFirst({ where: { ...scope, channel: CHANNEL, externalRef: { startsWith: externalPrefix } }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { rawTextEnc: true } });
    if (prior) {
      const event = JSON.parse(decrypt(prior.rawTextEnc, AAD)) as ComparisonEntry;
      if (event.version === 1 && event.relationship === input.relationship && event.note === input.note) return { changed: false };
    }
    const entry: ComparisonEntry = { version: 1, event: 'OPERATOR_COMPARE', newerClaimId: newer.id, olderClaimId: older.id, relationship: input.relationship,
      note: input.note, newerStatement: decrypt(newer.statementEnc, 'knowledge.claim_statement'), olderStatement: decrypt(older.statementEnc, 'knowledge.claim_statement'),
      olderWasSuperseded: input.relationship === 'SUPERSEDES', actor: 'OPERATOR' };
    await tx.interaction.create({ data: { ...scope, channel: CHANNEL, sourceType: 'WORKSPACE', externalRef: `${externalPrefix}${randomUUID()}`, rawTextEnc: encrypt(JSON.stringify(entry), AAD) } });
    if (input.relationship === 'SUPERSEDES') {
      // Retain encrypted original claim and evidence. Active topic links remain in the DB as history,
      // but normal topic and current-knowledge queries exclude superseded claims.
      const updated = await tx.knowledgeClaim.updateMany({ where: { id: older.id, ...scope, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } });
      if (updated.count !== 1) throw new Error('The earlier statement changed during review. Reload and try again.');
    }
    return { changed: true };
  });
}

export async function listDatingKnowledgeComparisons(scope: Scope) {
  await requireDatingPerson(scope);
  const rows = await prisma.interaction.findMany({ where: { ...scope, channel: CHANNEL }, select: { id: true, occurredAt: true, rawTextEnc: true }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 150 });
  return rows.map(row => ({ id: row.id, at: row.occurredAt, ...JSON.parse(decrypt(row.rawTextEnc, AAD)) as ComparisonEntry }))
    .filter(entry => entry.version === 1 && entry.event === 'OPERATOR_COMPARE');
}

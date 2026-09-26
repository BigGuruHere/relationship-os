// Stage 8.12.8 - reviewable structure, not automatic profiling or sharing consent.
// KnowledgeClaim and KnowledgeEvidence remain the source of truth. Topic links add organisation only.
import { prisma } from '$lib/db';
import { encrypt, decrypt, buildScopedIndexToken } from '$lib/crypto';

export const REALMS = [
  { key: 'romantic_relationships', name: 'Romantic relationships' },
  { key: 'friendships', name: 'Friendships and social life' },
  { key: 'work', name: 'Work and business' },
  { key: 'family', name: 'Family' },
  { key: 'interests', name: 'Lifestyle and interests' },
  { key: 'direction', name: 'Values and life direction' },
  { key: 'other', name: 'Other and emerging' }
] as const;
export type RealmKey = typeof REALMS[number]['key'];
export type Scope = { userId: string; contextSpaceId: string; contactId: string };
const LABEL_AAD = 'dating.understanding.label';

export function realmName(key: string): string | null { return REALMS.find(r => r.key === key)?.name ?? null; }
export function validateTopicName(input: unknown): string {
  const name = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 100) throw new Error('Topic name must contain 2 to 100 characters.');
  return name;
}

// Heuristics are informational hints for the operator, never persisted assignments.
// An item may span multiple realms. Do not infer sensitive traits from these rules.
export function possibleRealmHint(kind: string, statement: string): RealmKey | null {
  const s = statement.toLocaleLowerCase();
  if (/romantic|dating|girlfriend|boyfriend|relationship readiness|marriage|spouse/.test(s)) return 'romantic_relationships';
  if (/friend|social circle|networking|social group/.test(s)) return 'friendships';
  if (/business|career|work|employment|job/.test(s)) return 'work';
  if (/children|family|parent|daughter|son/.test(s)) return 'family';
  if (/tennis|walking|music|hobby|sport|exercise/.test(s)) return 'interests';
  if (kind === 'OBJECTIVE') return 'direction';
  return null;
}

export async function requireDatingPerson(scope: Scope) {
  const [space, person] = await Promise.all([
    prisma.contextSpace.findFirst({ where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey: 'dating' }, select: { id: true } }),
    prisma.contact.findFirst({ where: { id: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, select: { id: true } })
  ]);
  if (!space || !person) throw new Error('Person is not in the active Dating space.');
}

export async function listUnderstandingTopics(scope: Scope) {
  await requireDatingPerson(scope);
  const realms = await prisma.understandingRealm.findMany({ where: { ...scope },
    select: { id: true, key: true, nameEnc: true, topics: {
      select: { id: true, nameEnc: true, links: {
        where: { ...scope, claim: { status: 'ACTIVE' } },
        select: { id: true, claimId: true, claim: { select: { kind: true, statementEnc: true, authority: true } } }
      } }, orderBy: { createdAt: 'asc' }
    } }, orderBy: { createdAt: 'asc' }
  });
  return realms.map(realm => ({ id: realm.id, key: realm.key, name: decrypt(realm.nameEnc, LABEL_AAD),
    topics: realm.topics.map(topic => ({ id: topic.id, name: decrypt(topic.nameEnc, LABEL_AAD),
      claims: topic.links.map(link => ({ id: link.claimId, kind: link.claim.kind,
        statement: decrypt(link.claim.statementEnc, 'knowledge.claim_statement'), authority: link.claim.authority })) })) }));
}

export async function createUnderstandingTopic(scope: Scope, realmKey: string, rawName: unknown) {
  await requireDatingPerson(scope);
  const name = validateTopicName(rawName);
  const label = realmName(realmKey);
  if (!label) throw new Error('Choose a supported realm.');
  return prisma.$transaction(async tx => {
    const realm = await tx.understandingRealm.upsert({
      where: { userId_contextSpaceId_contactId_key: { ...scope, key: realmKey } },
      create: { ...scope, key: realmKey, nameEnc: encrypt(label, LABEL_AAD) }, update: {}, select: { id: true }
    });
    const nameIdx = buildScopedIndexToken(name, 'dating:understanding:topic');
    return tx.understandingTopic.upsert({
      where: { userId_contextSpaceId_contactId_realmId_nameIdx: { ...scope, realmId: realm.id, nameIdx } },
      create: { ...scope, realmId: realm.id, nameEnc: encrypt(name, LABEL_AAD), nameIdx },
      update: {}, select: { id: true }
    });
  });
}

export async function assignKnowledgeTopic(scope: Scope, claimId: string, topicId: string) {
  await requireDatingPerson(scope);
  // Both IDs are checked *before* writing. Database composite keys and triggers guard against races/raw SQL.
  const [claim, topic] = await Promise.all([
    prisma.knowledgeClaim.findFirst({ where: { id: claimId, ...scope, status: 'ACTIVE' }, select: { id: true } }),
    prisma.understandingTopic.findFirst({ where: { id: topicId, ...scope }, select: { id: true } })
  ]);
  if (!claim || !topic) throw new Error('Active knowledge or topic was not found for this person.');
  await prisma.understandingTopicClaim.upsert({
    where: { userId_contextSpaceId_contactId_topicId_claimId: { ...scope, topicId, claimId } },
    create: { ...scope, topicId, claimId }, update: {}
  });
}

export async function unassignKnowledgeTopic(scope: Scope, claimId: string, topicId: string) {
  await requireDatingPerson(scope);
  await prisma.understandingTopicClaim.deleteMany({ where: { ...scope, claimId, topicId } });
}

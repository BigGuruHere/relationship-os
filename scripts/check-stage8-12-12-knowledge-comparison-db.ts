// Stage 8.12.12: opt-in dev DB integration tests for explicit comparison, idempotency and custody.
// Never run against production. Creates only disposable contacts and cleans them up.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') throw new Error('Explicit development DB authorisation required.');
for (const key of ['DATABASE_URL', 'SECRET_MASTER_KEY', 'DATING_TEST_USER_ID', 'DATING_TEST_CONTEXT_SPACE_ID']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, crypto, living, topics, compare] = await Promise.all([
  import('../src/lib/db'), import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'), import('../src/lib/server/datingLivingUnderstanding'),
  import('../src/lib/server/datingUnderstandingTopics'), import('../src/lib/server/datingKnowledgeComparison')
]);
const base = { userId: process.env.DATING_TEST_USER_ID!, contextSpaceId: process.env.DATING_TEST_CONTEXT_SPACE_ID! };
const custody = <T>(run: () => Promise<T>) => runWithWorkspaceCustody(base, run);
const fixtureIds: string[] = [];
try {
  const space = await prisma.contextSpace.findFirst({ where: { id: base.contextSpaceId, ownerUserId: base.userId, domainKey: 'dating' } });
  assert.ok(space, 'Test context must be an owned Dating development ContextSpace.');
  for (let i = 0; i < 2; i++) {
    const name = `stage81212-${randomUUID()}`;
    const contact = await custody(() => prisma.contact.create({ data: {
      ...base, fullNameEnc: crypto.encrypt(name, 'contact.full_name'), fullNameIdx: crypto.buildIndexToken(name), source: 'MANUAL'
    }, select: { id: true } }));
    fixtureIds.push(contact.id);
  }
  const scope = { ...base, contactId: fixtureIds[0] };
  const other = { ...base, contactId: fixtureIds[1] };
  const topic = await custody(() => topics.createUnderstandingTopic(scope, 'romantic_relationships', 'Relationship readiness'));
  const createClaim = async (text: string, target = scope) => {
    await custody(() => living.createDatingUnderstanding(target, { statement: text, kind: 'PREFERENCE', decision: 'CONFIRMED' }));
    const claims = await custody(() => living.listCurrentDatingKnowledge(target));
    return claims.find((row: { statement: string }) => row.statement === text)!.id;
  };
  const earlier = await createClaim('Open to meeting a compatible romantic partner');
  const newer = await createClaim('Currently dating someone, but uncertain about commitment');
  const foreign = await createClaim('Would like to make new friends', other);
  await custody(() => topics.assignKnowledgeTopic(scope, earlier, topic.id));
  await custody(() => topics.assignKnowledgeTopic(scope, newer, topic.id));
  await assert.rejects(() => custody(() => compare.compareDatingKnowledge(scope, { newerClaimId: newer, olderClaimId: foreign, relationship: 'SUPPORTS' })));
  await assert.rejects(() => custody(() => compare.compareDatingKnowledge(scope, { newerClaimId: newer, olderClaimId: earlier, relationship: 'SUPERSEDES' })));
  console.log('PASS cross-person comparisons and unacknowledged retirement are rejected');
  assert.deepEqual(await custody(() => compare.compareDatingKnowledge(scope, { newerClaimId: newer, olderClaimId: earlier, relationship: 'REFINES', note: 'Adds current circumstances' })), { changed: true });
  assert.deepEqual(await custody(() => compare.compareDatingKnowledge(scope, { newerClaimId: newer, olderClaimId: earlier, relationship: 'REFINES', note: 'Adds current circumstances' })), { changed: false });
  assert.equal((await custody(() => compare.listDatingKnowledgeComparisons(scope))).length, 1);
  console.log('PASS repeated identical comparison is idempotent and its history is scoped');
  assert.deepEqual(await custody(() => compare.compareDatingKnowledge(scope, { newerClaimId: newer, olderClaimId: earlier, relationship: 'SUPERSEDES', acknowledgeSupersession: true })), { changed: true });
  const active = await custody(() => living.listCurrentDatingKnowledge(scope));
  assert.ok(active.some((row: { id: string }) => row.id === newer));
  assert.ok(!active.some((row: { id: string }) => row.id === earlier));
  const retired = await custody(() => prisma.knowledgeClaim.findFirst({ where: { id: earlier, ...scope }, include: { evidence: true } }));
  assert.equal(retired?.status, 'SUPERSEDED');
  assert.ok(retired?.evidence.length);
  assert.equal((await custody(() => compare.listDatingKnowledgeComparisons(scope))).length, 2);
  assert.equal((await custody(() => compare.listDatingKnowledgeComparisons(other))).length, 0);
  console.log('PASS retirement hides old claim from active view while preserving evidence and operator comparison history');
} finally {
  try {
    if (fixtureIds.length) await custody(async () => {
      const where = { ...base, contactId: { in: fixtureIds } };
      const claims = await prisma.knowledgeClaim.findMany({ where, select: { id: true } });
      const ids = claims.map((row: { id: string }) => row.id);
      await prisma.understandingTopicClaim.deleteMany({ where });
      await prisma.understandingTopic.deleteMany({ where });
      await prisma.understandingRealm.deleteMany({ where });
      if (ids.length) await prisma.knowledgeEvidence.deleteMany({ where: { ...base, claimId: { in: ids } } });
      if (ids.length) await prisma.knowledgeClaim.deleteMany({ where: { ...base, id: { in: ids } } });
      await prisma.interaction.deleteMany({ where });
      await prisma.contact.deleteMany({ where: { ...base, id: { in: fixtureIds } } });
    });
    console.log('PASS disposable fixture cleanup');
  } finally { await prisma.$disconnect(); }
}

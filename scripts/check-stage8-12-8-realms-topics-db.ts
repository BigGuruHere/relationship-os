// Stage 8.12.8 - opt-in integration verification on development Neon only.
// Disposable contacts exclusively. Never runs in npm test and never resets an existing database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') throw new Error('Explicit development DB authorisation required.');
for (const key of ['DATABASE_URL','SECRET_MASTER_KEY','DATING_TEST_USER_ID','DATING_TEST_CONTEXT_SPACE_ID']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, crypto, living, topics] = await Promise.all([
  import('../src/lib/db'), import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'), import('../src/lib/server/datingLivingUnderstanding'),
  import('../src/lib/server/datingUnderstandingTopics')
]);
const base = { userId: process.env.DATING_TEST_USER_ID!, contextSpaceId: process.env.DATING_TEST_CONTEXT_SPACE_ID! };
const custody = <T>(run: () => Promise<T>) => runWithWorkspaceCustody(base, run);
const fixtureIds: string[] = [];
try {
  const space = await prisma.contextSpace.findFirst({ where: { id: base.contextSpaceId, ownerUserId: base.userId, domainKey: 'dating' } });
  assert.ok(space, 'Test context must be an owned Dating ContextSpace in the development database.');
  for (let n = 0; n < 2; n++) {
    const label = `stage8128-${randomUUID()}`;
    const contact = await custody(() => prisma.contact.create({ data: {
      ...base, fullNameEnc: crypto.encrypt(label, 'contact.full_name'), fullNameIdx: crypto.buildIndexToken(label), source: 'MANUAL'
    }, select: { id: true } }));
    fixtureIds.push(contact.id);
  }
  const scope = { ...base, contactId: fixtureIds[0] };
  const other = { ...base, contactId: fixtureIds[1] };
  const romantic = await custody(() => topics.createUnderstandingTopic(scope, 'romantic_relationships', 'Desired relationship'));
  const friendships = await custody(() => topics.createUnderstandingTopic(scope, 'friendships', 'Social circle'));
  assert.notEqual(romantic.id, friendships.id);
  const tree = await custody(() => topics.listUnderstandingTopics(scope));
  assert.equal(tree.length, 2);
  assert.equal(tree[0].topics[0].name, 'Desired relationship');
  console.log('PASS realm and encrypted topic labels belong to one Dating person');

  const pid = await custody(() => living.createDatingUnderstanding(scope, { statement: 'Values closeness while maintaining individuality', kind: 'PREFERENCE', decision: 'CONFIRMED' }));
  const claim = (await custody(() => living.listCurrentDatingKnowledge(scope)))[0];
  assert.ok(pid && claim);
  await custody(() => topics.assignKnowledgeTopic(scope, claim.id, romantic.id));
  await custody(() => topics.assignKnowledgeTopic(scope, claim.id, romantic.id));
  await custody(() => topics.assignKnowledgeTopic(scope, claim.id, friendships.id));
  let links = await custody(() => prisma.understandingTopicClaim.findMany({ where: { ...scope, claimId: claim.id } }));
  assert.equal(links.length, 2, 'Identical assignment is idempotent and cross-realm links do not duplicate the claim.');
  console.log('PASS same claim may be linked to two topics without duplicated claims or source evidence');

  const foreignTopic = await custody(() => topics.createUnderstandingTopic(other, 'family', 'Family time'));
  await assert.rejects(() => custody(() => topics.assignKnowledgeTopic(scope, claim.id, foreignTopic.id)));
  await assert.rejects(() => custody(() => topics.assignKnowledgeTopic(other, claim.id, foreignTopic.id)));
  await assert.rejects(() => custody(() => prisma.understandingTopicClaim.create({ data: {
    ...scope, topicId: foreignTopic.id, claimId: claim.id
  } })));
  await assert.rejects(() => custody(() => prisma.understandingTopicClaim.create({ data: {
    ...other, topicId: foreignTopic.id, claimId: claim.id
  } })));
  console.log('PASS service and PostgreSQL reject cross-person topic and claim links');

  await custody(() => topics.unassignKnowledgeTopic(scope, claim.id, romantic.id));
  links = await custody(() => prisma.understandingTopicClaim.findMany({ where: { ...scope, claimId: claim.id } }));
  assert.equal(links.length, 1);
  assert.equal((await custody(() => living.listCurrentDatingKnowledge(scope))).length, 1);
  console.log('PASS removing topic assignment does not delete current knowledge');
} finally {
  try {
    if (fixtureIds.length) await custody(async () => {
      // KnowledgeClaim uses onDelete: SetNull for Contact, so clear fixture claims BEFORE deleting contacts.
      // Otherwise the test would leave orphaned knowledge even though its people were deleted.
      const where = { ...base, contactId: { in: fixtureIds } };
      const claims = await prisma.knowledgeClaim.findMany({ where, select: { id: true } });
      const claimIds = claims.map(row => row.id);
      await prisma.understandingTopicClaim.deleteMany({ where });
      await prisma.understandingTopic.deleteMany({ where });
      await prisma.understandingRealm.deleteMany({ where });
      if (claimIds.length) await prisma.knowledgeEvidence.deleteMany({ where: { ...base, claimId: { in: claimIds } } });
      if (claimIds.length) await prisma.knowledgeClaim.deleteMany({ where: { ...base, id: { in: claimIds } } });
      await prisma.interaction.deleteMany({ where });
      await prisma.contact.deleteMany({ where: { ...base, id: { in: fixtureIds } } });
    });
    console.log('PASS disposable fixture cleanup without orphan claims');
  } finally { await prisma.$disconnect(); }
}

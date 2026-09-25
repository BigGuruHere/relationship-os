// PURPOSE: Live PostgreSQL smoke test for the 8.12.0.1 workflow, including concurrent repeat review.
// SAFETY: Runs only with explicit development opt-in and deletes only its own fixture records.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') throw new Error('Set ALLOW_DATING_DEV_DB_TEST=YES after verifying your development DATABASE_URL.');
if (!process.env.DATABASE_URL || !process.env.SECRET_MASTER_KEY || !process.env.DATING_TEST_USER_ID || !process.env.DATING_TEST_CONTEXT_SPACE_ID) throw new Error('Missing development database, encryption key or Dating test identifiers.');
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, { encrypt, buildIndexToken }, service] = await Promise.all([
  import('../src/lib/db'), import('../src/lib/server/core/contextSpace'), import('../src/lib/crypto'), import('../src/lib/server/datingLivingUnderstanding')
]);
const userId = process.env.DATING_TEST_USER_ID!;
const contextSpaceId = process.env.DATING_TEST_CONTEXT_SPACE_ID!;
let contactId = '';
const custody = <T>(fn: () => T | Promise<T>) => runWithWorkspaceCustody({ userId, contextSpaceId }, fn);
try {
  const space = await prisma.contextSpace.findFirst({ where: { id: contextSpaceId, ownerUserId: userId, domainKey: 'dating' }, select: { id: true } });
  assert.ok(space, 'The configured ContextSpace must be owned by the test user and belong to Dating.');
  const name = `stage8-12-0-1-${randomUUID()}`;
  const contact = await custody(() => prisma.contact.create({ data: {
    userId, contextSpaceId, fullNameEnc: encrypt(name, 'contact.full_name'), fullNameIdx: buildIndexToken(name), source: 'MANUAL'
  }, select: { id: true } }));
  contactId = contact.id;
  const scope = { userId, contextSpaceId, contactId };
  const id = await custody(() => service.createDatingUnderstanding(scope, { statement: 'Enjoys walking by the sea', decision: 'CONFIRMED', note: 'Pilot conversation' }));
  let entries = await custody(() => service.listDatingUnderstanding(scope));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, id);
  assert.equal(entries[0].history.length, 1);
  assert.equal(entries[0].decision, 'CONFIRMED');
  console.log('PASS one initial confirmation creates one statement and one review');
  await custody(() => service.reviewDatingUnderstanding(scope, { proposalId: id, statement: 'Enjoys walking by the sea', decision: 'CONFIRMED' }));
  entries = await custody(() => service.listDatingUnderstanding(scope));
  assert.equal(entries[0].history.length, 1);
  console.log('PASS unchanged repeat creates no duplicate history');
  const repeats = await Promise.allSettled(Array.from({ length: 2 }, () => custody(() => service.reviewDatingUnderstanding(scope, {
    proposalId: id, statement: 'Enjoys walking by the sea', decision: 'DEFERRED'
  }))));
  assert.ok(repeats.every(result => result.status === 'fulfilled'), 'Both concurrent attempts must complete');
  entries = await custody(() => service.listDatingUnderstanding(scope));
  assert.equal(entries[0].history.length, 2);
  assert.equal(entries[0].decision, 'DEFERRED');
  console.log('PASS concurrent repeat creates one meaningful revision');
  await custody(() => service.reviewDatingUnderstanding(scope, {
    proposalId: id, statement: 'Enjoys evening walks', decision: 'CONFIRMED', note: 'Corrected after reviewing initial conversation'
  }));
  entries = await custody(() => service.listDatingUnderstanding(scope));
  assert.equal(entries[0].history.length, 3);
  assert.equal(entries[0].statement, 'Enjoys walking by the sea');
  assert.equal(entries[0].reviewedStatement, 'Enjoys evening walks');
  console.log('PASS original proposal retained after meaningful revision');
  await assert.rejects(() => custody(() => service.listDatingUnderstanding({ ...scope, contextSpaceId: randomUUID() })));
  console.log('PASS cross-context request denied');
} finally {
  if (contactId) {
    try {
      await custody(async () => {
        // Delete evidence before its associated claims and source Interactions.
        const rows = await prisma.interaction.findMany({ where: { userId, contextSpaceId, contactId, channel: 'DATING_LIVING_UNDERSTANDING' }, select: { id: true } });
        const sourceIds = rows.map(row => row.id);
        const evidence = await prisma.knowledgeEvidence.findMany({ where: { userId, contextSpaceId, sourceInteractionId: { in: sourceIds } }, select: { id: true, claimId: true } });
        await prisma.knowledgeEvidence.deleteMany({ where: { userId, contextSpaceId, id: { in: evidence.map(e => e.id) } } });
        await prisma.knowledgeClaim.deleteMany({ where: { userId, contextSpaceId, contactId, id: { in: evidence.map(e => e.claimId) } } });
        await prisma.interaction.deleteMany({ where: { userId, contextSpaceId, id: { in: sourceIds } } });
        await prisma.contact.deleteMany({ where: { userId, contextSpaceId, id: contactId } });
      });
      console.log('PASS fixture-only cleanup');
    } finally { await prisma.$disconnect(); }
  } else await prisma.$disconnect();
}

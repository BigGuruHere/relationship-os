// Stage 8.12.3: disposable fixture integration test on an explicitly authorised development database.
// Uses only new, isolated Contact and dependent records. Never resets a database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') {
  throw new Error('Set ALLOW_DATING_DEV_DB_TEST=YES only after verifying DATABASE_URL points to development.');
}
if (!process.env.DATABASE_URL || !process.env.SECRET_MASTER_KEY || !process.env.DATING_TEST_USER_ID || !process.env.DATING_TEST_CONTEXT_SPACE_ID) {
  throw new Error('Development database, encryption key and test fixture IDs are required.');
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, crypto, understanding, history] = await Promise.all([
  import('../src/lib/db'), import('../src/lib/server/core/contextSpace'), import('../src/lib/crypto'),
  import('../src/lib/server/datingLivingUnderstanding'), import('../src/lib/server/datingPersonHistory')
]);
const base = { userId: process.env.DATING_TEST_USER_ID, contextSpaceId: process.env.DATING_TEST_CONTEXT_SPACE_ID };
const custody = <T>(action: () => Promise<T>) => runWithWorkspaceCustody(base, action);
const fixtures: string[] = [];
try {
  const space = await prisma.contextSpace.findFirst({ where: {
    id: base.contextSpaceId, ownerUserId: base.userId, domainKey: 'dating'
  }, select: { id: true } });
  assert.ok(space, 'The provided IDs must refer to the development Dating ContextSpace.');
  for (let i = 0; i < 2; i++) {
    const label = `stage8123-${randomUUID()}`;
    const contact = await custody(() => prisma.contact.create({ data: {
      ...base, fullNameEnc: crypto.encrypt(label, 'contact.full_name'),
      fullNameIdx: crypto.buildIndexToken(label), source: 'MANUAL'
    }, select: { id: true } }));
    fixtures.push(contact.id);
  }
  const scope = { ...base, contactId: fixtures[0] };
  const other = { ...base, contactId: fixtures[1] };
  const source = await custody(() => history.createPersonReflection(scope, { text: 'I liked being listened to on my walk.' }));
  await assert.rejects(() => custody(() => understanding.createDatingUnderstanding(other, {
    statement: 'Values being listened to', kind: 'PREFERENCE', sourceInteractionId: source.id, decision: 'CONFIRMED'
  })));
  console.log('PASS private source cannot be attached to another person');
  const proposalId = await custody(() => understanding.createDatingUnderstanding(scope, {
    statement: 'Values being listened to', kind: 'PREFERENCE', sourceInteractionId: source.id, decision: 'PENDING'
  }));
  let items = await custody(() => understanding.listDatingUnderstanding(scope));
  assert.equal(items.find(item => item.id === proposalId)?.sourceInteractionId, source.id);
  let current = await custody(() => understanding.listCurrentDatingKnowledge(scope));
  assert.equal(current.length, 0, 'Unreviewed proposals must not become active knowledge');
  console.log('PASS proposed knowledge retains source and is not silently activated');
  await custody(() => understanding.reviewDatingUnderstanding(scope, {
    proposalId, statement: 'Values being listened to', decision: 'CONFIRMED'
  }));
  current = await custody(() => understanding.listCurrentDatingKnowledge(scope));
  assert.equal(current.length, 1);
  assert.equal(current[0].kind, 'PREFERENCE');
  assert.equal(current[0].authority, 'THIRD_PARTY_REPORTED');
  assert.equal(current[0].evidenceCount, 2, 'Both operator review and original reflection must be linked');
  const activeEvidence = await custody(() => prisma.knowledgeEvidence.findMany({ where: {
    ...base, claimId: current[0].id, status: 'ACTIVE'
  }, select: { sourceInteractionId: true } }));
  assert.ok(activeEvidence.some(row => row.sourceInteractionId === source.id));
  console.log('PASS a reviewed proposal appears as a typed active claim with original provenance');
  await custody(() => understanding.reviewDatingUnderstanding(scope, {
    proposalId, statement: 'Values being listened to', decision: 'CONFIRMED'
  }));
  current = await custody(() => understanding.listCurrentDatingKnowledge(scope));
  assert.equal(current.length, 1);
  assert.equal(current[0].evidenceCount, 2);
  console.log('PASS unchanged review does not duplicate claims or evidence');
  await custody(() => understanding.reviewDatingUnderstanding(scope, {
    proposalId, statement: 'Values being listened to', decision: 'REJECTED'
  }));
  current = await custody(() => understanding.listCurrentDatingKnowledge(scope));
  assert.equal(current.length, 0);
  const after = await custody(() => history.loadPersonHistory(scope));
  assert.equal(after.reflections.length, 1);
  assert.equal(after.reflections[0].text, 'I liked being listened to on my walk.');
  console.log('PASS rejecting a claim removes it from current profile without rewriting history');
} finally {
  try {
    if (fixtures.length) await custody(async () => {
      // Fixture contacts are unique and no pre-existing records can refer to them.
      const scoped = { ...base, contactId: { in: fixtures } };
      const claims = await prisma.knowledgeClaim.findMany({ where: scoped, select: { id: true } });
      const ids = claims.map(row => row.id);
      if (ids.length) await prisma.knowledgeEvidence.deleteMany({ where: { ...base, claimId: { in: ids } } });
      if (ids.length) await prisma.knowledgeClaim.deleteMany({ where: { ...base, id: { in: ids } } });
      await prisma.interaction.deleteMany({ where: scoped });
      await prisma.contact.deleteMany({ where: { ...base, id: { in: fixtures } } });
    });
    console.log('PASS fixture-only cleanup');
  } finally {
    await prisma.$disconnect();
  }
}

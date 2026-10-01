// Stage 8.12.14.1 - explicit, disposable development-DB persistence check.
// SAFETY: requires opt-in and existing Dating development fixture ids. Never run on production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') throw new Error('Explicit development DB authorisation required.');
for (const key of ['DATABASE_URL', 'SECRET_MASTER_KEY', 'DATING_TEST_USER_ID', 'DATING_TEST_CONTEXT_SPACE_ID']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';

const [{ prisma }, custodyApi, crypto, persisted] = await Promise.all([
  import('../src/lib/db'),
  import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'),
  import('../src/lib/server/datingPersistedLivingUnderstanding')
]);

const base = { userId: process.env.DATING_TEST_USER_ID!, contextSpaceId: process.env.DATING_TEST_CONTEXT_SPACE_ID! };
const custody = <T>(run: () => Promise<T>) => custodyApi.runWithWorkspaceCustody(base, run);
let contactId: string | undefined;
let sourceInteractionId: string | undefined;

function proposal(scope: { userId: string; contextSpaceId: string; contactId: string }, sourceId: string, duplicate = false) {
  const topic = (targetKey: string, text: string) => ({
    realm: 'Development validation',
    topicName: 'Persistence fixture',
    proposedUnderstanding: text,
    temporalScope: 'CURRENT',
    operation: 'KEEP',
    sourceTargetKeys: [targetKey]
  });
  return {
    priorSeeds: [
      { targetKey: 'fixture-a', sourceInteractionId: sourceId, sourceInteractionIds: [sourceId] },
      ...(duplicate ? [{ targetKey: 'fixture-b', sourceInteractionId: sourceId, sourceInteractionIds: [sourceId] }] : [])
    ],
    analysis: {
      validForReview: true,
      errors: [],
      proposedTopics: [
        topic('fixture-a', 'The development persistence fixture preserves an authorised current understanding with source provenance.'),
        ...(duplicate ? [topic('fixture-b', 'The duplicate fixture deliberately targets the same topic identity to exercise transaction rollback.')] : [])
      ]
    }
  };
}

try {
  const space = await prisma.contextSpace.findFirst({ where: { id: base.contextSpaceId, ownerUserId: base.userId, domainKey: 'dating' }, select: { id: true } });
  assert.ok(space, 'Use an owned Dating DEVELOPMENT ContextSpace.');

  const label = `stage812141-${randomUUID()}`;
  const contact = await custody(() => prisma.contact.create({ data: {
    ...base,
    fullNameEnc: crypto.encrypt(label, 'contact.full_name'),
    fullNameIdx: crypto.buildIndexToken(label),
    source: 'MANUAL'
  }, select: { id: true } }));
  contactId = contact.id;
  const scope = { ...base, contactId };

  const source = await custody(() => prisma.interaction.create({ data: {
    ...scope,
    channel: 'DATING_PERSON_REFLECTION',
    sourceType: 'WORKSPACE',
    externalRef: `stage8.12.14.1:${randomUUID()}`,
    rawTextEnc: crypto.encrypt(JSON.stringify({
      version: 1,
      kind: 'PERSONAL_REFLECTION',
      actor: 'OPERATOR',
      text: 'This disposable development reflection exists only to test authorised Living Understanding persistence.'
    }), 'interaction.raw_text')
  }, select: { id: true } }));
  sourceInteractionId = source.id;

  const token = persisted.createLivingUnderstandingAdoptionToken(scope, proposal(scope, source.id));
  const first = await custody(() => persisted.adoptLivingUnderstanding(scope, token));
  assert.equal(first.alreadyAdopted, false);
  const current = await custody(() => persisted.getCurrentLivingUnderstanding(scope));
  assert.ok(current);
  assert.equal(current.revisionNumber, 1);
  assert.equal(current.topics.length, 1);
  assert.equal(current.sources.length, 1);
  assert.equal(current.sources[0].sourceInteractionId, source.id);
  assert.match(current.topics[0].understanding, /authorised current understanding/i);
  console.log('PASS authorised Living Understanding revision, topic and provenance persist and decrypt');

  const again = await custody(() => persisted.adoptLivingUnderstanding(scope, token));
  assert.equal(again.alreadyAdopted, true);
  assert.equal(await custody(() => prisma.livingUnderstandingRevision.count({ where: scope })), 1);
  console.log('PASS repeat approval is idempotent');

  const beforeRollback = await custody(() => prisma.livingUnderstandingRevision.count({ where: scope }));
  const rollbackToken = persisted.createLivingUnderstandingAdoptionToken(scope, proposal(scope, source.id, true));
  await assert.rejects(() => custody(() => persisted.adoptLivingUnderstanding(scope, rollbackToken)));
  const afterRollback = await custody(() => prisma.livingUnderstandingRevision.count({ where: scope }));
  assert.equal(afterRollback, beforeRollback, 'Failed adoption must roll back the whole revision transaction.');
  console.log('PASS failed topic write rolls back revision and provenance atomically');

  const history = await custody(() => persisted.listLivingUnderstandingRevisionHistory(scope));
  assert.equal(history.length, 1);
  assert.equal(history[0]._count.topics, 1);
  assert.equal(history[0]._count.sources, 1);
  console.log('PASS authorised revision history is readable after persistence');
} finally {
  try {
    if (contactId) await custody(async () => {
      // Contact cascades delete fixture revisions, versions, identities, sources and reflection.
      await prisma.contact.deleteMany({ where: { ...base, id: contactId } });
    });
    console.log('PASS disposable Living Understanding fixture cleanup');
  } finally {
    await prisma.$disconnect();
  }
}

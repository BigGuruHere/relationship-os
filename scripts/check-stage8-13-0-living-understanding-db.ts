// Stage 8.13.0 - explicit, disposable development-DB longitudinal persistence check.
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

async function createReflection(scope: { userId: string; contextSpaceId: string; contactId: string }, text: string) {
  return custody(() => prisma.interaction.create({
    data: {
      ...scope,
      channel: 'DATING_PERSON_REFLECTION',
      sourceType: 'WORKSPACE',
      externalRef: `stage8.13.0:${randomUUID()}`,
      rawTextEnc: crypto.encrypt(JSON.stringify({
        version: 1,
        kind: 'PERSONAL_REFLECTION',
        actor: 'OPERATOR',
        text
      }), 'interaction.raw_text')
    },
    select: { id: true }
  }));
}

try {
  const space = await prisma.contextSpace.findFirst({
    where: { id: base.contextSpaceId, ownerUserId: base.userId, domainKey: 'dating' },
    select: { id: true }
  });
  assert.ok(space, 'Use an owned Dating DEVELOPMENT ContextSpace.');

  const label = `stage8130-${randomUUID()}`;
  const contact = await custody(() => prisma.contact.create({
    data: {
      ...base,
      fullNameEnc: crypto.encrypt(label, 'contact.full_name'),
      fullNameIdx: crypto.buildIndexToken(label),
      source: 'MANUAL'
    },
    select: { id: true }
  }));
  contactId = contact.id;
  const scope = { ...base, contactId };

  const source1 = await createReflection(scope, 'Initial test evidence defines two authoritative Living Understanding topics.');
  const source2 = await createReflection(scope, 'Later test evidence materially changes only the relationship readiness topic.');

  const v1 = await custody(() => persisted.persistLongitudinalLivingUnderstandingRevision(scope, {
    baselineRevisionId: null,
    adoptionKey: `stage8.13.0:v1:${randomUUID()}`,
    revisionSourceIds: [source1.id],
    changes: [],
    newTopics: [
      {
        realm: 'Romantic relationships',
        topicName: 'Relationship readiness',
        proposedUnderstanding: 'The fixture initially remains uncertain about readiness for a serious relationship while staying open to connection.',
        temporalScope: 'CURRENT',
        operation: 'NEW_TOPIC',
        sourceInteractionIds: [source1.id]
      },
      {
        realm: 'Friendships and social life',
        topicName: 'Social Circle',
        proposedUnderstanding: 'The fixture values a small stable social circle and prefers depth over broad casual social contact.',
        temporalScope: 'CURRENT',
        operation: 'NEW_TOPIC',
        sourceInteractionIds: [source1.id]
      }
    ]
  }));
  assert.equal(v1.alreadyAdopted, false);

  const currentV1 = await custody(() => persisted.getCurrentLivingUnderstanding(scope));
  assert.ok(currentV1);
  assert.equal(currentV1.revisionNumber, 1);
  assert.equal(currentV1.topics.length, 2);
  const readinessV1 = currentV1.topics.find((topic: any) => topic.topicName === 'Relationship readiness');
  const socialV1 = currentV1.topics.find((topic: any) => topic.topicName === 'Social Circle');
  assert.ok(readinessV1 && socialV1);
  assert.equal(readinessV1.topicVersionNumber, 1);
  assert.equal(socialV1.topicVersionNumber, 1);
  console.log('PASS v1 creates first immutable topic versions and snapshot membership');

  const v2Key = `stage8.13.0:v2:${randomUUID()}`;
  const v2 = await custody(() => persisted.persistLongitudinalLivingUnderstandingRevision(scope, {
    baselineRevisionId: currentV1.id,
    adoptionKey: v2Key,
    revisionSourceIds: [source2.id],
    changes: [{
      topicIdentityId: readinessV1.topicIdentityId,
      proposedUnderstanding: 'The fixture is now more open to a serious relationship when it feels mutual, spacious and deliberately chosen.',
      temporalScope: 'CURRENT',
      operation: 'REFINED',
      sourceInteractionIds: [source2.id]
    }],
    newTopics: []
  }));
  assert.equal(v2.alreadyAdopted, false);

  const currentV2 = await custody(() => persisted.getCurrentLivingUnderstanding(scope));
  assert.ok(currentV2);
  assert.equal(currentV2.revisionNumber, 2);
  assert.equal(currentV2.previousRevisionId, currentV1.id);
  const readinessV2 = currentV2.topics.find((topic: any) => topic.topicName === 'Relationship readiness');
  const socialV2 = currentV2.topics.find((topic: any) => topic.topicName === 'Social Circle');
  assert.ok(readinessV2 && socialV2);
  assert.notEqual(readinessV2.topicVersionId, readinessV1.topicVersionId, 'Changed topic must receive a new topic version.');
  assert.equal(readinessV2.topicVersionNumber, 2);
  assert.equal(socialV2.topicVersionId, socialV1.topicVersionId, 'Unchanged topic must carry forward the exact prior topicVersionId.');
  assert.equal(socialV2.topicVersionNumber, 1);
  assert.deepEqual(readinessV2.sources.map((row: any) => row.sourceInteractionId), [source2.id]);
  assert.deepEqual(socialV2.sources.map((row: any) => row.sourceInteractionId), [source1.id]);
  console.log('PASS v2 changes only the affected topic and carries the unchanged topic version forward');

  const repeated = await custody(() => persisted.persistLongitudinalLivingUnderstandingRevision(scope, {
    baselineRevisionId: currentV1.id,
    adoptionKey: v2Key,
    revisionSourceIds: [source2.id],
    changes: [{
      topicIdentityId: readinessV1.topicIdentityId,
      proposedUnderstanding: 'The fixture is now more open to a serious relationship when it feels mutual, spacious and deliberately chosen.',
      temporalScope: 'CURRENT',
      operation: 'REFINED',
      sourceInteractionIds: [source2.id]
    }],
    newTopics: []
  }));
  assert.equal(repeated.alreadyAdopted, true);
  assert.equal(await custody(() => prisma.livingUnderstandingRevision.count({ where: scope })), 2);
  console.log('PASS exact repeat save is idempotent');

  await assert.rejects(
    () => custody(() => persisted.persistLongitudinalLivingUnderstandingRevision(scope, {
      baselineRevisionId: currentV1.id,
      adoptionKey: `stage8.13.0:stale:${randomUUID()}`,
      revisionSourceIds: [source2.id],
      changes: [{
        topicIdentityId: readinessV1.topicIdentityId,
        proposedUnderstanding: 'This stale proposal must never be allowed to overwrite a newer authoritative baseline revision.',
        temporalScope: 'CURRENT',
        operation: 'REFINED',
        sourceInteractionIds: [source2.id]
      }],
      newTopics: []
    })),
    /STALE_BASELINE/
  );
  console.log('PASS stale-baseline approval is rejected');

  const beforeRollback = await custody(() => prisma.livingUnderstandingRevision.count({ where: scope }));
  await assert.rejects(() => custody(() => persisted.persistLongitudinalLivingUnderstandingRevision(scope, {
    baselineRevisionId: currentV2.id,
    adoptionKey: `stage8.13.0:rollback:${randomUUID()}`,
    revisionSourceIds: [source2.id],
    changes: [],
    // IT: Deliberately collides with an existing topic identity after the new revision row is created.
    // The whole transaction must roll back rather than leave a partial revision.
    newTopics: [{
      realm: 'Friendships and social life',
      topicName: 'Social Circle',
      proposedUnderstanding: 'This duplicate topic fixture deliberately exercises transaction rollback after revision creation has begun.',
      temporalScope: 'CURRENT',
      operation: 'NEW_TOPIC',
      sourceInteractionIds: [source2.id]
    }]
  })));
  const afterRollback = await custody(() => prisma.livingUnderstandingRevision.count({ where: scope }));
  assert.equal(afterRollback, beforeRollback, 'Failed longitudinal persistence must roll back the whole revision transaction.');
  console.log('PASS failed write rolls back revision, memberships and provenance atomically');

  const history = await custody(() => persisted.listLivingUnderstandingRevisionHistory(scope));
  assert.equal(history.length, 2);
  assert.equal(history[0]._count.topics, 2);
  assert.equal(history[0]._count.createdTopicVersions, 1);
  assert.equal(history[1]._count.createdTopicVersions, 2);
  console.log('PASS revision history distinguishes snapshot size from changed topic-version count');
} finally {
  try {
    if (contactId) await custody(async () => {
      // IT: Contact custody cascades delete the disposable fixture interactions and Living Understanding rows.
      await prisma.contact.deleteMany({ where: { ...base, id: contactId } });
    });
    console.log('PASS disposable Stage 8.13.0 fixture cleanup');
  } finally {
    await prisma.$disconnect();
  }
}

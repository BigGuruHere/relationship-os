// Stage 8.13.3 - inspect an existing DEVELOPMENT person's latest two authoritative revisions.
// SAFETY: read-only. Requires explicit opt-in and an exact development contact id.
import assert from 'node:assert/strict';

if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') throw new Error('Explicit development DB authorisation required.');
for (const key of ['DATABASE_URL', 'SECRET_MASTER_KEY', 'DATING_TEST_USER_ID', 'DATING_TEST_CONTEXT_SPACE_ID', 'DATING_TEST_CONTACT_ID']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';

const [{ prisma }, custodyApi, persisted] = await Promise.all([
  import('../src/lib/db'),
  import('../src/lib/server/core/contextSpace'),
  import('../src/lib/server/datingPersistedLivingUnderstanding')
]);

const scope = {
  userId: process.env.DATING_TEST_USER_ID!,
  contextSpaceId: process.env.DATING_TEST_CONTEXT_SPACE_ID!,
  contactId: process.env.DATING_TEST_CONTACT_ID!
};
const base = { userId: scope.userId, contextSpaceId: scope.contextSpaceId };
const custody = <T>(run: () => Promise<T>) => custodyApi.runWithWorkspaceCustody(base, run);

try {
  const history = await custody(() => persisted.listLivingUnderstandingRevisionHistory(scope));
  assert.ok(history.length >= 2, 'This check requires at least two authoritative revisions.');
  const latestNumber = history[0].revisionNumber;
  const previousNumber = history[1].revisionNumber;
  const [latest, previous] = await custody(() => Promise.all([
    persisted.getLivingUnderstandingRevision(scope, latestNumber),
    persisted.getLivingUnderstandingRevision(scope, previousNumber)
  ]));
  assert.ok(latest && previous);
  assert.equal(latest.previousRevisionId, previous.id, 'Latest revision must point to the preceding authoritative revision.');

  const previousByIdentity = new Map(previous.topics.map((topic: any) => [topic.topicIdentityId, topic]));
  const latestByIdentity = new Map(latest.topics.map((topic: any) => [topic.topicIdentityId, topic]));
  assert.equal(latestByIdentity.size, latest.topics.length, 'Latest snapshot must contain one membership per topic identity.');

  const revisionSourceIds = new Set(latest.sources.map((source: any) => source.sourceInteractionId));
  let carriedForward = 0;
  let changed = 0;
  let newTopics = 0;
  for (const topic of latest.topics as any[]) {
    const prior = previousByIdentity.get(topic.topicIdentityId) as any;
    if (!prior) {
      newTopics += 1;
      assert.ok(topic.sources.some((source: any) => revisionSourceIds.has(source.sourceInteractionId)), 'A new topic version must retain provenance from the latest revision source.');
      continue;
    }
    if (prior.topicVersionId === topic.topicVersionId) {
      carriedForward += 1;
      assert.equal(topic.topicVersionNumber, prior.topicVersionNumber, 'Carried-forward topic must keep the exact topic version number.');
      assert.ok(!topic.sources.some((source: any) => revisionSourceIds.has(source.sourceInteractionId)), 'An unchanged carried-forward topic must not gain provenance from the latest revision source.');
    } else {
      changed += 1;
      assert.ok(topic.topicVersionNumber > prior.topicVersionNumber, 'Changed topic must receive a later immutable topic version.');
      assert.ok(topic.sources.some((source: any) => revisionSourceIds.has(source.sourceInteractionId)), 'Changed topic must retain provenance from the latest revision source.');
    }
  }

  console.log(`PASS latest authoritative v${latestNumber} follows v${previousNumber}`);
  console.log(`PASS ${carriedForward} unchanged topic version(s) carried forward by exact id`);
  console.log(`PASS ${changed} changed topic version(s) have latest-source provenance`);
  console.log(`PASS ${newTopics} genuinely new topic(s) have latest-source provenance`);
  console.log(`PASS latest revision has ${revisionSourceIds.size} revision source(s) and ${latest.topics.length} topic memberships`);
} finally {
  await prisma.$disconnect();
}

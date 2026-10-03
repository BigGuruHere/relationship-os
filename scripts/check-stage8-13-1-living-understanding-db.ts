// Stage 8.13.1 - opt-in development DB test for signed longitudinal approval -> authoritative v2.
// SAFETY: requires explicit development authorisation and disposable Dating fixture ids. Never run on production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') throw new Error('Explicit development DB authorisation required.');
for (const key of ['DATABASE_URL', 'SECRET_MASTER_KEY', 'DATING_TEST_USER_ID', 'DATING_TEST_CONTEXT_SPACE_ID']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';

const [{ prisma }, custodyApi, crypto, persisted, longitudinal] = await Promise.all([
  import('../src/lib/db'),
  import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'),
  import('../src/lib/server/datingPersistedLivingUnderstanding'),
  import('../src/lib/server/datingLongitudinalLivingUnderstanding')
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
      externalRef: `stage8.13.1:${randomUUID()}`,
      rawTextEnc: crypto.encrypt(JSON.stringify({ version: 1, kind: 'PERSONAL_REFLECTION', actor: 'OPERATOR', text }), 'interaction.raw_text')
    },
    select: { id: true }
  }));
}

try {
  const space = await prisma.contextSpace.findFirst({ where: { id: base.contextSpaceId, ownerUserId: base.userId, domainKey: 'dating' }, select: { id: true } });
  assert.ok(space, 'Use an owned Dating DEVELOPMENT ContextSpace.');

  const label = `stage8131-${randomUUID()}`;
  const contact = await custody(() => prisma.contact.create({
    data: { ...base, fullNameEnc: crypto.encrypt(label, 'contact.full_name'), fullNameIdx: crypto.buildIndexToken(label), source: 'MANUAL' },
    select: { id: true }
  }));
  contactId = contact.id;
  const scope = { ...base, contactId };

  const source1 = await createReflection(scope, 'Initial evidence creates three authoritative topics for the longitudinal production fixture.');
  const source2 = await createReflection(scope, 'Later evidence changes relationship readiness while leaving the social circle and work priorities untouched.');

  await custody(() => persisted.persistLongitudinalLivingUnderstandingRevision(scope, {
    baselineRevisionId: null,
    adoptionKey: `stage8.13.1:v1:${randomUUID()}`,
    revisionSourceIds: [source1.id],
    changes: [],
    newTopics: [
      { realm: 'Romantic relationships', topicName: 'Relationship readiness', proposedUnderstanding: 'The fixture is cautious about a serious relationship and does not want to force one before it feels genuinely right.', temporalScope: 'CURRENT', operation: 'NEW_TOPIC', sourceInteractionIds: [source1.id] },
      { realm: 'Friendships and social life', topicName: 'Social Circle', proposedUnderstanding: 'The fixture values a small stable social circle and prefers depth over broad casual social contact.', temporalScope: 'CURRENT', operation: 'NEW_TOPIC', sourceInteractionIds: [source1.id] },
      { realm: 'Work and career', topicName: 'Business priorities and work-life balance', proposedUnderstanding: 'The fixture wants meaningful business progress while retaining enough space for family and a sustainable life.', temporalScope: 'CURRENT', operation: 'NEW_TOPIC', sourceInteractionIds: [source1.id] }
    ]
  }));

  const v1 = await custody(() => persisted.getAuthoritativeLivingUnderstandingBaseline(scope));
  assert.ok(v1);
  const readiness1 = v1.topics.find((topic: any) => topic.topicName === 'Relationship readiness');
  const social1 = v1.topics.find((topic: any) => topic.topicName === 'Social Circle');
  const work1 = v1.topics.find((topic: any) => topic.topicName === 'Business priorities and work-life balance');
  assert.ok(readiness1 && social1 && work1);

  const approvalToken = longitudinal.createLongitudinalImpactApprovalTokenForValidatedProposal(scope, {
    baselineRevisionId: v1.id,
    baselineRevisionNumber: v1.revisionNumber,
    sourceInteractionId: source2.id,
    changes: [{
      topicIdentityId: readiness1.topicIdentityId,
      proposedUnderstanding: 'The fixture is now more open to a serious relationship when it feels mutual, spacious and deliberately chosen rather than obligatory.',
      temporalScope: 'CURRENT',
      operation: 'REFINED',
      relationshipType: 'INFORMED'
    }],
    newTopics: []
  });

  const created = await custody(() => longitudinal.approveLivingUnderstandingImpact(scope, approvalToken));
  assert.equal(created.revisionNumber, 2);
  assert.equal(created.alreadyAdopted, false);

  const v2 = await custody(() => persisted.getAuthoritativeLivingUnderstandingBaseline(scope));
  assert.ok(v2);
  assert.equal(v2.revisionNumber, 2);
  const readiness2 = v2.topics.find((topic: any) => topic.topicName === 'Relationship readiness');
  const social2 = v2.topics.find((topic: any) => topic.topicName === 'Social Circle');
  const work2 = v2.topics.find((topic: any) => topic.topicName === 'Business priorities and work-life balance');
  assert.ok(readiness2 && social2 && work2);
  assert.notEqual(readiness2.topicVersionId, readiness1.topicVersionId);
  assert.equal(social2.topicVersionId, social1.topicVersionId);
  assert.equal(work2.topicVersionId, work1.topicVersionId);
  assert.deepEqual(readiness2.sources.map((row: any) => row.sourceInteractionId), [source2.id]);
  assert.deepEqual(social2.sources.map((row: any) => row.sourceInteractionId), [source1.id]);
  assert.deepEqual(work2.sources.map((row: any) => row.sourceInteractionId), [source1.id]);
  console.log('PASS signed Stage 8.13.1 approval creates v2 and carries unchanged topicVersionIds forward');

  const repeated = await custody(() => longitudinal.approveLivingUnderstandingImpact(scope, approvalToken));
  assert.equal(repeated.alreadyAdopted, true);
  assert.equal(await custody(() => prisma.livingUnderstandingRevision.count({ where: scope })), 2);
  console.log('PASS signed repeat approval is idempotent');

  const source3 = await createReflection(scope, 'A third source exists only to prove a proposal based on v1 cannot be approved after v2 exists.');
  const staleToken = longitudinal.createLongitudinalImpactApprovalTokenForValidatedProposal(scope, {
    baselineRevisionId: v1.id,
    baselineRevisionNumber: v1.revisionNumber,
    sourceInteractionId: source3.id,
    changes: [{
      topicIdentityId: readiness1.topicIdentityId,
      proposedUnderstanding: 'This stale proposal must not create a revision because its authoritative baseline is no longer current.',
      temporalScope: 'CURRENT', operation: 'REFINED', relationshipType: 'INFORMED'
    }],
    newTopics: []
  });
  await assert.rejects(() => custody(() => longitudinal.approveLivingUnderstandingImpact(scope, staleToken)), /STALE_BASELINE/);
  console.log('PASS signed stale-baseline approval fails closed');

  const crossContact = await custody(() => prisma.contact.create({
    data: { ...base, fullNameEnc: crypto.encrypt(`${label}-other`, 'contact.full_name'), fullNameIdx: crypto.buildIndexToken(`${label}-other`), source: 'MANUAL' },
    select: { id: true }
  }));
  try {
    const wrongScope = { ...base, contactId: crossContact.id };
    await assert.rejects(() => custody(() => longitudinal.approveLivingUnderstandingImpact(wrongScope, approvalToken)), /does not belong/);
    console.log('PASS signed approval cannot cross person custody');
  } finally {
    await custody(() => prisma.contact.deleteMany({ where: { ...base, id: crossContact.id } }));
  }
} finally {
  try {
    if (contactId) await custody(() => prisma.contact.deleteMany({ where: { ...base, id: contactId } }));
    console.log('PASS disposable Stage 8.13.1 fixture cleanup');
  } finally {
    await prisma.$disconnect();
  }
}

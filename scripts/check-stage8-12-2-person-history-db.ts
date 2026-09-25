// Stage 8.12.2: opt-in database verification using only disposable test fixtures.
// Never reset or edit existing user records; no model calls or external disclosure.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') {
  throw new Error('Set ALLOW_DATING_DEV_DB_TEST=YES only after verifying DATABASE_URL targets development.');
}
if (!process.env.DATABASE_URL || !process.env.SECRET_MASTER_KEY || !process.env.DATING_TEST_USER_ID || !process.env.DATING_TEST_CONTEXT_SPACE_ID) {
  throw new Error('Missing required development database, encryption key or test fixture identifiers.');
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, { encrypt, buildIndexToken }, history] = await Promise.all([
  import('../src/lib/db'),
  import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'),
  import('../src/lib/server/datingPersonHistory')
]);
const userId = process.env.DATING_TEST_USER_ID;
const contextSpaceId = process.env.DATING_TEST_CONTEXT_SPACE_ID;
const base = { userId, contextSpaceId };
const custody = <T>(fn: () => Promise<T>) => runWithWorkspaceCustody(base, fn);
const contactIds: string[] = [];
const interactionIds: string[] = [];
const touchpointIds: string[] = [];

try {
  const space = await prisma.contextSpace.findFirst({ where: { id: contextSpaceId, ownerUserId: userId, domainKey: 'dating' }, select: { id: true } });
  assert.ok(space, 'Expected existing owned Dating development ContextSpace.');
  for (let i = 0; i < 3; i++) {
    const label = `stage8122-${randomUUID()}-${i}`;
    const row = await custody(() => prisma.contact.create({ data: {
      ...base, fullNameEnc: encrypt(label, 'contact.full_name'), fullNameIdx: buildIndexToken(label), source: 'MANUAL'
    }, select: { id: true } }));
    contactIds.push(row.id);
  }
  const first = { ...base, contactId: contactIds[0] };
  const outsider = { ...base, contactId: contactIds[2] };
  const independent = await custody(() => history.createPersonReflection(first, { text: 'A private reflection before ever meeting anyone.' }));
  interactionIds.push(independent.id);
  let loaded = await custody(() => history.loadPersonHistory(first));
  assert.equal(loaded.reflections.length, 1);
  assert.equal(loaded.reflections[0].touchpointId, null);
  assert.equal(loaded.touchpoints.length, 0);
  assert.equal(loaded.introductions.length, 0);
  assert.equal(loaded.timeline.length, 1);
  console.log('PASS a person has private history with no introduction or touchpoint');

  const eventId = await custody(() => history.createPersonTouchpoint(first, {
    kind: 'IN_PERSON', attendeeIds: [contactIds[0], contactIds[1]], note: 'Private encounter note'
  }));
  touchpointIds.push(eventId);
  const event = await custody(() => prisma.touchpoint.findFirstOrThrow({
    where: { id: eventId, ...base }, include: { participants: true }
  }));
  assert.equal(event.participants.length, 2);
  assert.equal(event.relatingId, null);
  console.log('PASS two-person touchpoint remains independent of Relating');

  const linked = await custody(() => history.createPersonReflection(first, { text: 'This is my account of the encounter.', touchpointId: eventId }));
  interactionIds.push(linked.id);
  await assert.rejects(() => custody(() => history.createPersonReflection(outsider, {
    text: 'An outsider must not attach an account to the event.', touchpointId: eventId
  })));
  loaded = await custody(() => history.loadPersonHistory(first));
  assert.equal(loaded.reflections.length, 2);
  assert.equal(loaded.touchpoints.length, 1);
  assert.equal(loaded.timeline.length, 3);
  console.log('PASS attendee reflection and person-first timeline; non-attendee denied');

  await assert.rejects(() => custody(() => history.createPersonReflection({ ...base, contactId: randomUUID() }, {
    text: 'An inaccessible contact must not receive a reflection.'
  })));
  const unrelated = await custody(() => history.loadPersonHistory(outsider));
  assert.equal(unrelated.reflections.length, 0);
  assert.equal(unrelated.touchpoints.length, 0);
  await assert.rejects(() => custody(() => history.loadPersonHistory({ ...first, userId: randomUUID() })));
  console.log('PASS person and owner isolation');
} finally {
  try {
    // All queries are bound to known fixture IDs to avoid touching existing development data.
    if (interactionIds.length) await custody(() => prisma.interaction.deleteMany({ where: { ...base, id: { in: interactionIds } } }));
    if (touchpointIds.length) await custody(() => prisma.touchpointParticipant.deleteMany({ where: { ...base, touchpointId: { in: touchpointIds } } }));
    if (touchpointIds.length) await custody(() => prisma.touchpoint.deleteMany({ where: { ...base, id: { in: touchpointIds } } }));
    if (contactIds.length) await custody(() => prisma.contact.deleteMany({ where: { ...base, id: { in: contactIds } } }));
    console.log('PASS fixture-only cleanup');
  } finally {
    // Explicit closure prevents a background connection from holding the test open.
    await prisma.$disconnect();
  }
}

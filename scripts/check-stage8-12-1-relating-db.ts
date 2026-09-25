// Stage 8.12.1 opt-in PostgreSQL integration test, using isolated, self-owned fixtures.
// SAFETY: Never reset the database, never alter existing contacts/intros, always disconnect.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') {
  throw new Error('Set ALLOW_DATING_DEV_DB_TEST=YES after verifying DATABASE_URL points to development.');
}
if (!process.env.DATABASE_URL || !process.env.SECRET_MASTER_KEY || !process.env.DATING_TEST_USER_ID || !process.env.DATING_TEST_CONTEXT_SPACE_ID) {
  throw new Error('Database, encryption key and two Dating fixture identifiers are required.');
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, crypto, relatingService] = await Promise.all([
  import('../src/lib/db'),
  import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'),
  import('../src/lib/server/relating')
]);
const userId = process.env.DATING_TEST_USER_ID;
const contextSpaceId = process.env.DATING_TEST_CONTEXT_SPACE_ID;
const scope = { userId, contextSpaceId };
const custody = <T>(fn: () => T | Promise<T>, contextId = contextSpaceId) =>
  runWithWorkspaceCustody({ userId, contextSpaceId: contextId }, fn);
const contactIds: string[] = [];
const eventIds: string[] = [];
const groupIds: string[] = [];
let otherContextId = '';
let otherContactId = '';
let introductionId = '';
let introductionGroupId = '';

try {
  const space = await prisma.contextSpace.findFirst({
    where: { id: contextSpaceId, ownerUserId: userId, domainKey: 'dating' }, select: { id: true }
  });
  assert.ok(space, 'Existing Dating test ContextSpace must belong to the configured user.');

  // Create three distinct people without touching any user's existing contacts.
  for (let i = 0; i < 3; i++) {
    const label = `relating8121-${randomUUID()}-${i}`;
    const person = await custody(() => prisma.contact.create({
      data: { ...scope, fullNameEnc: crypto.encrypt(label, 'contact.full_name'),
        fullNameIdx: crypto.buildIndexToken(label), source: 'MANUAL' }, select: { id: true }
    }));
    contactIds.push(person.id);
  }
  const groupId = await custody(() => relatingService.createRelating(scope, contactIds.map(contactId => ({ contactId }))));
  groupIds.push(groupId);
  const members = await custody(() => prisma.relatingParticipant.findMany({
    where: { ...scope, relatingId: groupId }, orderBy: { joinedAt: 'asc' }, select: { id: true, contactId: true }
  }));
  assert.equal(members.length, 3);
  console.log('PASS three people participate in one Relating history without side A/B');

  // Two attendees from a three-person group; the third member is not an attendee.
  const groupEventId = await custody(() => relatingService.createTouchpoint(scope, {
    relatingId: groupId, kind: 'MEETING', attendees: members.slice(0, 2).map(m => ({ relatingParticipantId: m.id }))
  }));
  eventIds.push(groupEventId);
  const groupEvent = await custody(() => prisma.touchpoint.findFirst({
    where: { ...scope, id: groupEventId }, include: { participants: true }
  }));
  assert.equal(groupEvent?.participants.length, 2);
  console.log('PASS touchpoint attendees are independent of group membership');

  // A standalone encounter does not invent a continuing group or an introduction.
  const standaloneId = await custody(() => relatingService.createTouchpoint(scope, {
    kind: 'PHONE_CALL', attendees: [{ contactId: contactIds[2] }]
  }));
  eventIds.push(standaloneId);
  const standalone = await custody(() => prisma.touchpoint.findFirst({ where: { ...scope, id: standaloneId } }));
  assert.equal(standalone?.relatingId, null);
  console.log('PASS one-off touchpoint needs no Relating history');

  // Existing two-person introduction flows now create a private Relating history atomically.
  const { createIntroductionFromForm } = await import('../src/lib/server/introductions');
  const form = new FormData();
  form.set('partyAContactId', contactIds[0]);
  form.set('partyBContactId', contactIds[1]);
  form.set('reason', 'Stage 8.12.1 temporary integration fixture');
  const intro = await custody(() => createIntroductionFromForm(userId, form));
  introductionId = intro.id;
  const linked = await custody(() => prisma.introduction.findFirstOrThrow({
    where: { ...scope, id: introductionId }, select: { relatingId: true, participants: true }
  }));
  assert.ok(linked.relatingId);
  introductionGroupId = linked.relatingId!;
  groupIds.push(introductionGroupId);
  const introMembers = await custody(() => prisma.relatingParticipant.count({
    where: { ...scope, relatingId: introductionGroupId }
  }));
  assert.equal(linked.participants.length, 2);
  assert.equal(introMembers, 2);
  console.log('PASS new two-person introduction creates its private Relating history');

  // Create a throwaway second custody space to test same-owner cross-context denial.
  otherContextId = randomUUID();
  await prisma.contextSpace.create({ data: {
    id: otherContextId, ownerUserId: userId, kind: 'OTHER', domainKey: 'dating', isDefault: false
  } });
  const label = `relating8121-isolation-${randomUUID()}`;
  const other = await custody(() => prisma.contact.create({ data: {
    userId, contextSpaceId: otherContextId, fullNameEnc: crypto.encrypt(label, 'contact.full_name'),
    fullNameIdx: crypto.buildIndexToken(label), source: 'MANUAL'
  }, select: { id: true } }), otherContextId);
  otherContactId = other.id;
  await assert.rejects(() => custody(() => prisma.relatingParticipant.create({ data: {
    ...scope, relatingId: groupId, contactId: otherContactId
  } })));
  await assert.rejects(() => custody(() => prisma.touchpoint.create({ data: {
    userId, contextSpaceId: otherContextId, relatingId: groupId, kind: 'MEETING'
  } }), otherContextId));
  const crossContextRead = await custody(() => prisma.relating.findFirst({
    where: { userId, contextSpaceId: otherContextId, id: groupId }
  }), otherContextId);
  assert.equal(crossContextRead, null);
  console.log('PASS same-owner cross-context reads and references denied');
  await assert.rejects(() => custody(() => relatingService.createRelating(
    { userId: randomUUID(), contextSpaceId }, [{ contactId: contactIds[0] }]
  )));
  console.log('PASS cross-owner service operation denied');

  // Database guard must also reject a member of another group at this touchpoint.
  const otherGroupId = await custody(() => relatingService.createRelating(scope, [{ contactId: contactIds[2] }]));
  groupIds.push(otherGroupId);
  const foreignMember = await custody(() => prisma.relatingParticipant.findFirstOrThrow({
    where: { ...scope, relatingId: otherGroupId }, select: { id: true }
  }));
  await assert.rejects(() => custody(() => prisma.touchpointParticipant.create({ data: {
    ...scope, touchpointId: groupEventId, relatingParticipantId: foreignMember.id
  } })));
  console.log('PASS another group member cannot masquerade as an attendee');
} finally {
  // Delete only unique fixtures introduced by this script in dependency order.
  try {
    if (eventIds.length) await custody(() => prisma.touchpointParticipant.deleteMany({ where: { ...scope, touchpointId: { in: eventIds } } }));
    if (eventIds.length) await custody(() => prisma.touchpoint.deleteMany({ where: { ...scope, id: { in: eventIds } } }));
    if (introductionId) await custody(() => prisma.introduction.deleteMany({ where: { ...scope, id: introductionId } }));
    if (groupIds.length) await custody(() => prisma.relatingParticipant.deleteMany({ where: { ...scope, relatingId: { in: groupIds } } }));
    if (groupIds.length) await custody(() => prisma.relating.deleteMany({ where: { ...scope, id: { in: groupIds } } }));
    if (contactIds.length) await custody(() => prisma.contact.deleteMany({ where: { ...scope, id: { in: contactIds } } }));
    if (otherContactId && otherContextId) await custody(() => prisma.contact.deleteMany({
      where: { userId, contextSpaceId: otherContextId, id: otherContactId }
    }), otherContextId);
    if (otherContextId) await prisma.contextSpace.deleteMany({ where: { id: otherContextId, ownerUserId: userId } });
    console.log('PASS fixture-only cleanup');
  } finally {
    await prisma.$disconnect();
  }
}

// PURPOSE: Explicit, disposable development-DB check for original transcript storage.
// SAFETY: Requires opt-in and an existing owned Dating fixture; never run on production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (process.env.ALLOW_DATING_DEV_DB_TEST !== 'YES') throw new Error('Explicit development DB authorisation required.');
for (const key of ['DATABASE_URL', 'SECRET_MASTER_KEY', 'DATING_TEST_USER_ID', 'DATING_TEST_CONTEXT_SPACE_ID']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
process.env.DB_KEEPALIVE_DISABLED = 'YES';
const [{ prisma }, { runWithWorkspaceCustody }, crypto, importer] = await Promise.all([
  import('../src/lib/db'), import('../src/lib/server/core/contextSpace'),
  import('../src/lib/crypto'), import('../src/lib/server/datingTranscriptImport')
]);
const scope = { userId: process.env.DATING_TEST_USER_ID!, contextSpaceId: process.env.DATING_TEST_CONTEXT_SPACE_ID! };
const custody = <T>(run: () => Promise<T>) => runWithWorkspaceCustody(scope, run);
let fixtureContactId: string | undefined;
let fixtureTranscriptId: string | undefined;
try {
  const space = await prisma.contextSpace.findFirst({ where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey: 'dating' } });
  assert.ok(space, 'Use an owned Dating DEVELOPMENT context.');
  const label = `stage812132-${randomUUID()}`;
  const contact = await custody(() => prisma.contact.create({ data: {
    ...scope, fullNameEnc: crypto.encrypt(label, 'contact.full_name'), fullNameIdx: crypto.buildIndexToken(label), source: 'MANUAL'
  }, select: { id: true } }));
  fixtureContactId = contact.id;
  const transcript = `User: Fixture conversation ${label}.\nAgent: Acknowledged.`;
  const mapping = { User: contact.id, Agent: 'SKIP' };
  const result = await custody(() => importer.importDatingTranscript(scope, transcript, mapping));
  fixtureTranscriptId = result.transcriptId;
  assert.equal(result.excerpts.length, 1);
  const original = await custody(() => prisma.interaction.findFirstOrThrow({
    where: { id: result.transcriptId, ...scope }, select: { contactId: true, personId: true, companyId: true, channel: true }
  }));
  assert.equal(original.contactId, null);
  assert.equal(original.personId, null);
  assert.equal(original.companyId, null);
  assert.equal(original.channel, 'DATING_CONVERSATION_TRANSCRIPT');
  console.log('PASS workspace transcript stored without arbitrarily claiming an individual subject');
  assert.equal((await custody(() => importer.importDatingTranscript(scope, transcript, mapping))).alreadyImported, true);
  console.log('PASS reimport is idempotent');
  await assert.rejects(() => custody(() => prisma.interaction.create({ data: {
    ...scope, channel: 'DATING_PERSON_REFLECTION', rawTextEnc: crypto.encrypt(label, 'interaction.raw_text'), sourceType: 'WORKSPACE'
  } })));
  console.log('PASS an ordinary interaction without a subject remains forbidden');
} finally {
  try {
    await custody(async () => {
      if (fixtureTranscriptId) await prisma.interaction.deleteMany({ where: { ...scope, OR: [
        { id: fixtureTranscriptId }, { externalRef: { startsWith: `dating:transcript-excerpt:${fixtureTranscriptId}:` } }
      ] } });
      if (fixtureContactId) await prisma.contact.deleteMany({ where: { ...scope, id: fixtureContactId } });
    });
    console.log('PASS disposable transcript fixture cleanup');
  } finally { await prisma.$disconnect(); }
}

// Stage 8.15.4.7c.2: Opt-in DEVELOPMENT database tests for provisional telephone session constraints.
// SECURITY: This script does not call real phone numbers, touch existing transcripts, or print identities.
// It creates temporary sessions for existing provisional callers and removes them in finally.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Explicit operator opt-in prevents accidental execution against a production database.
if (process.env.ALLOW_RELISH_PHONE_DEV_DB_TEST !== 'YES' || process.env.RELISH_DB_ENV !== 'development' || process.env.NODE_ENV === 'production') {
  throw new Error('Refusing database writes. Set ALLOW_RELISH_PHONE_DEV_DB_TEST=YES and RELISH_DB_ENV=development; never run on production.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Confirm it targets Neon DEVELOPMENT before running.');

const db = new PrismaClient();
const created: string[] = [];
const tag = `conv_c2${randomUUID().replaceAll('-', '')}`;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenHash = () => hash(randomBytes(32).toString('base64url'));
let passed = 0;

try {
  // Read already-provisioned callers. Do not create users, contexts or contacts in a database test.
  const callers = await db.networkPhoneCaller.findMany({ take: 2, orderBy: { createdAt: 'asc' } });
  assert.ok(callers.length, 'At least one existing DEVELOPMENT provisional caller is required. Complete one test call first.');
  for (const caller of callers) {
    const [space, contact, user] = await Promise.all([
      db.contextSpace.findFirst({ where: { id: caller.contextSpaceId, ownerUserId: caller.userId, domainKey: 'general' }, select: { id: true } }),
      db.contact.findFirst({ where: { id: caller.contactId, contextSpaceId: caller.contextSpaceId, userId: caller.userId, linkedUserId: caller.userId }, select: { id: true } }),
      db.user.findUnique({ where: { id: caller.userId }, select: { email_Idx: true, oauthAccounts: { take: 1, select: { id: true } } } })
    ]);
    assert.ok(space && contact && user && !user.email_Idx && user.oauthAccounts.length === 0, 'Provisional caller custody must be intact and unauthenticated.');
  }
  console.log('PASS: existing provisional caller references and custody boundaries'); passed++;

  // Use an existing provider binding, but never start a real call or issue a provider credential.
  const binding = await db.agentProviderBinding.findFirst({ where: { provider: 'ELEVENLABS', isActive: true }, select: { id: true } });
  assert.ok(binding, 'Active DEVELOPMENT ElevenLabs provider binding required.');
  const caller = callers[0];
  const conversationId = `${tag}a`;
  const data = { userId: caller.userId, contextSpaceId: caller.contextSpaceId, contactId: caller.contactId, agentBindingId: binding.id, conversationId, expiresAt: new Date(Date.now() + 600000) };
  const first = await db.networkDorianSession.create({ data: { ...data, tokenHash: tokenHash() }, select: { id: true } });
  created.push(first.id);
  const attempts = await Promise.allSettled(Array.from({ length: 4 }, () => db.networkDorianSession.create({ data: { ...data, tokenHash: tokenHash() }, select: { id: true } })));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 0, 'Duplicate conversation initiations must not create another session.');
  assert.ok(attempts.every(result => result.status === 'rejected' && (result.reason as {code?: string}).code === 'P2002'), 'Duplicates must fail through the database unique constraint.');
  assert.equal(await db.networkDorianSession.count({ where: { conversationId } }), 1);
  console.log('PASS: concurrent duplicate conversation sessions rejected by PostgreSQL'); passed++;

  // Token hashes and conversation IDs are independently unique; no token reuse across sessions.
  const duplicateToken = await Promise.allSettled([
    db.networkDorianSession.create({ data: { ...data, conversationId: `${tag}b`, tokenHash: tokenHash() } }),
    db.networkDorianSession.create({ data: { ...data, conversationId: `${tag}c`, tokenHash: tokenHash() } })
  ]);
  for (const result of duplicateToken) if (result.status === 'fulfilled') created.push(result.value.id);
  assert.equal(duplicateToken.filter(result => result.status === 'fulfilled').length, 2);
  console.log('PASS: distinct sessions for distinct conversations'); passed++;

  if (callers.length === 2) {
    const second = callers[1];
    const secondRecord = await db.networkDorianSession.create({ data: { tokenHash: tokenHash(), conversationId: `${tag}d`, userId: second.userId, contextSpaceId: second.contextSpaceId, contactId: second.contactId, agentBindingId: binding.id, expiresAt: new Date(Date.now() + 600000) }, select: { id: true } });
    created.push(secondRecord.id);
    const rows = await db.networkDorianSession.findMany({ where: { id: { in: created } }, select: { id: true, userId: true, contextSpaceId: true, contactId: true } });
    assert.ok(rows.some(row => row.userId === caller.userId && row.contextSpaceId === caller.contextSpaceId && row.contactId === caller.contactId));
    assert.ok(rows.some(row => row.userId === second.userId && row.contextSpaceId === second.contextSpaceId && row.contactId === second.contactId));
    assert.notEqual(caller.userId, second.userId);
    assert.notEqual(caller.contextSpaceId, second.contextSpaceId);
    assert.notEqual(caller.contactId, second.contactId);
    console.log('PASS: two distinct provisional callers retain separate custody'); passed++;
  } else {
    console.log('NOT RUN: two-caller isolation check requires a second DEVELOPMENT provisional caller.');
  }
  console.log(`Stage 8.15.4.7c.2 DB checks passed: ${passed}. Session resolver and webhook idempotency still require separate end-to-end verification.`);
} finally {
  // Always remove only temporary sessions created by this test; never delete real caller records.
  if (created.length) await db.networkDorianSession.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
}

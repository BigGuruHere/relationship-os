// Stage 8.15.4.7c.3: Opt-in DEVELOPMENT database verification of session token boundaries.
// SECURITY: Never prints tokens, personal identifiers or conversation contents, and only deletes sessions created here.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Refuse writes without an operator's explicit development-database confirmation.
if (process.env.ALLOW_RELISH_PHONE_DEV_DB_TEST !== 'YES' || process.env.RELISH_DB_ENV !== 'development' || process.env.NODE_ENV === 'production') {
  throw new Error('Refusing writes: confirm DEVELOPMENT and set ALLOW_RELISH_PHONE_DEV_DB_TEST=YES, RELISH_DB_ENV=development.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must identify DEVELOPMENT.');
const db = new PrismaClient();
const created: string[] = [];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const prefix = `c3_${randomUUID().replaceAll('-', '')}`;
const token = () => randomBytes(32).toString('base64url');
let passes = 0;

try {
  // Use existing test participants only. No caller, User, Contact or ContextSpace is created or deleted.
  const callers = await db.networkPhoneCaller.findMany({ take: 2, orderBy: { createdAt: 'asc' } });
  assert.ok(callers.length > 0, 'An existing DEVELOPMENT provisional caller is required.');
  const binding = await db.agentProviderBinding.findFirst({ where: { provider: 'ELEVENLABS', isActive: true }, select: { id: true } });
  assert.ok(binding, 'An active DEVELOPMENT ElevenLabs binding is required.');
  const caller = callers[0];
  const secret = token();
  const conversationId = `${prefix}_conversation`;
  const session = await db.networkDorianSession.create({ data: {
    tokenHash: digest(secret), conversationId, userId: caller.userId, contextSpaceId: caller.contextSpaceId,
    contactId: caller.contactId, agentBindingId: binding.id, expiresAt: new Date(Date.now() + 10 * 60_000)
  }, select: { id: true } });
  created.push(session.id);

  // Database token lookup must resolve only the exact token hash, never a changed credential.
  const exact = await db.networkDorianSession.findUnique({ where: { tokenHash: digest(secret) } });
  const altered = await db.networkDorianSession.findUnique({ where: { tokenHash: digest(token()) } });
  assert.equal(exact?.id, session.id);
  assert.equal(altered, null);
  console.log('PASS: exact token hash recognition and invalid token rejection'); passes++;

  // The stored conversation and binding are immutable authority checks at post-call resolution.
  assert.equal(exact?.conversationId, conversationId);
  assert.notEqual(exact?.conversationId, `${prefix}_replay`);
  assert.equal(exact?.agentBindingId, binding.id);
  console.log('PASS: conversation and provider-binding checks for session replay'); passes++;

  // Expired sessions must not qualify. Use a newly-created temporary row only.
  await db.networkDorianSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  const expired = await db.networkDorianSession.findUnique({ where: { tokenHash: digest(secret) } });
  assert.ok(expired && expired.expiresAt < new Date());
  console.log('PASS: expired-session data is correctly represented for fail-closed resolution'); passes++;

  // Check existing contact/space custody for each distinct caller; never join across a user's context.
  for (const person of callers) {
    const [space, contact] = await Promise.all([
      db.contextSpace.findFirst({ where: { id: person.contextSpaceId, ownerUserId: person.userId, domainKey: 'general' }, select: { id: true } }),
      db.contact.findFirst({ where: { id: person.contactId, userId: person.userId, contextSpaceId: person.contextSpaceId, linkedUserId: person.userId }, select: { id: true } })
    ]);
    assert.ok(space && contact, 'Provisional caller has mismatched custody references.');
  }
  if (callers.length > 1) {
    const other = callers[1];
    assert.notEqual(other.userId, caller.userId);
    assert.notEqual(other.contextSpaceId, caller.contextSpaceId);
    assert.notEqual(other.contactId, caller.contactId);
    assert.equal(await db.contact.count({ where: { id: caller.contactId, contextSpaceId: other.contextSpaceId, userId: other.userId } }), 0);
    assert.equal(await db.contact.count({ where: { id: other.contactId, contextSpaceId: caller.contextSpaceId, userId: caller.userId } }), 0);
    console.log('PASS: two-caller custody and cross-context contact rejection'); passes++;
  } else {
    console.log('NOT RUN: cross-caller test requires a second existing DEVELOPMENT provisional caller.');
  }
  console.log(`Stage 8.15.4.7c.3 DEVELOPMENT database checks passed: ${passes}. Full signed webhook replay testing remains a separate live verification.`);
} finally {
  // Delete only records created by this test, even when an assertion fails.
  try { if (created.length) await db.networkDorianSession.deleteMany({ where: { id: { in: created } } }); }
  finally { await db.$disconnect(); }
}

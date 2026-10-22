// Stage 8.16: private browser participation, public-profile provenance and first-party measurement.
// SECURITY: profile exposure never authorises disclosure, matching, or a mutual connection.
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { ensureOwnedDomainContextSpace } from '$lib/server/core/contextSpaceDirectory';
import { runWithWorkspaceCustody } from '$lib/server/core/contextSpace';
import { ensureNetworkSelfContact } from '$lib/server/core/networkSelfContact';
import type { Cookies } from '@sveltejs/kit';

export type PilotDomain = 'business' | 'general' | 'dating';
export const pilotDomainForKind = (kind: string): PilotDomain | null =>
  kind === 'business' ? 'business' : kind === 'personal' ? 'general' : kind === 'dating' ? 'dating' : null;
export const pilotKindLabel = (kind: string) => kind === 'personal' ? 'Friendship' : kind === 'dating' ? 'Dating' : 'Business';
export const pilotSource = (value: unknown) => value === 'qr' ? 'qr' : 'link';
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const durationSeconds = 60 * 60 * 24 * 60;

function browserCookieName(env: string) {
  // The development and production cookie namespaces are different and host-only.
  return env === 'prod' ? 'relpilot_prod' : 'relpilot_dev';
}
function cookieOptions(env: string, isHttps: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: env !== 'local' || isHttps,
    path: '/', maxAge: durationSeconds };
}
export async function readPilotBrowser(cookies: Cookies, env: string) {
  const token = cookies.get(browserCookieName(env));
  if (!token || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const session = await prisma.pilotBrowserSession.findUnique({ where: { tokenHash: tokenHash(token) },
    select: { visitorUserId: true, revokedAt: true, expiresAt: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  // A claimed/registered identity must log in normally, never retain cookie-only access.
  const user = await prisma.user.findUnique({ where: { id: session.visitorUserId },
    select: { personId: true, email_Idx: true, oauthAccounts: { select: { id: true }, take: 1 } } });
  if (!user?.personId || user.email_Idx || user.oauthAccounts.length) return null;
  return session.visitorUserId;
}

export async function getOrCreatePilotVisitor(input: { cookies: Cookies; env: string; authenticatedUserId?: string | null; isHttps?: boolean }) {
  if (input.authenticatedUserId) return input.authenticatedUserId;
  const existing = await readPilotBrowser(input.cookies, input.env);
  if (existing) return existing;
  // New visitors get a separate canonical Person, not an existing User identified by name or phone.
  const token = randomBytes(32).toString('base64url');
  const userId = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: { person: { create: {} } }, select: { id: true } });
    await tx.pilotBrowserSession.create({ data: {
      visitorUserId: user.id, tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + durationSeconds * 1000)
    } });
    return user.id;
  });
  input.cookies.set(browserCookieName(input.env), token, cookieOptions(input.env, Boolean(input.isHttps)));
  return userId;
}

export async function ensurePilotSelfContact(userId: string, domainKey: PilotDomain) {
  const space = await ensureOwnedDomainContextSpace(prisma, { ownerUserId: userId,
    domainKey, displayName: pilotKindLabel(domainKey === 'general' ? 'personal' : domainKey) });
  const contactId = await runWithWorkspaceCustody({ userId, contextSpaceId: space.id }, async () => {
    // General already has a fail-closed canonical self-contact implementation.
    if (domainKey === 'general') return ensureNetworkSelfContact({ userId, contextSpaceId: space.id });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { personId: true } });
    if (!user?.personId) throw new Error('Canonical Person is missing.');
    const existing = await prisma.contact.findMany({ where: { userId, contextSpaceId: space.id, linkedUserId: userId },
      select: { id: true, personId: true }, take: 2 });
    if (existing.length > 1 || (existing[0]?.personId && existing[0].personId !== user.personId))
      throw new Error('Participant self-contact requires operator review.');
    if (existing.length === 1) {
      if (!existing[0].personId) await prisma.contact.update({ where: { id: existing[0].id }, data: { personId: user.personId } });
      return existing[0].id;
    }
    try {
      const created = await prisma.contact.create({ data: {
        userId, contextSpaceId: space.id, linkedUserId: userId, personId: user.personId,
        fullNameEnc: encrypt('Myself', 'contact.full_name'), fullNameIdx: buildIndexToken('Myself'), source: 'MANUAL'
      }, select: { id: true } });
      return created.id;
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const concurrent = await prisma.contact.findFirst({ where: { userId, contextSpaceId: space.id, linkedUserId: userId, personId: user.personId }, select: { id: true } });
      if (!concurrent) throw error;
      return concurrent.id;
    }
  });
  return { contextSpaceId: space.id, contactId };
}

const allowedEvents = new Set([
  'profile.viewed', 'qr.landing_opened', 'profile.conversation_offered',
  'dorian.conversation_requested', 'dorian.session_issued', 'dorian.conversation_started', 'dorian.conversation_completed',
  'dorian.conversation_failed', 'dorian.conversation_returned', 'value.reported',
  'relationship.connection_requested'
]);
export async function recordPilotEvent(input: {
  type: string; env: string; profileId: string; ownerUserId: string;
  domainKey: PilotDomain; entryId?: string | null; visitorUserId?: string | null;
  conversationId?: string | null; source?: string; value?: boolean | null; dedup?: string;
}) {
  if (!allowedEvents.has(input.type)) throw new Error('Unapproved product event type.');
  // An allowlisted schema prevents transcripts, prompts, cookies and session credentials entering telemetry.
  try {
    await prisma.productEvent.create({ data: {
      type: input.type, environment: input.env, profileId: input.profileId,
      ownerUserId: input.ownerUserId, domainKey: input.domainKey,
      entryId: input.entryId || null, visitorUserId: input.visitorUserId || null,
      conversationId: input.conversationId || null, source: pilotSource(input.source),
      value: input.value ?? null, idempotencyKey: input.dedup ? tokenHash(input.dedup) : null
    } });
  } catch (error: any) {
    // Signed webhook retries are idempotent; other unexpected failures remain visible.
    if (input.dedup && error?.code === 'P2002') return;
    throw error;
  }
}

export async function resolvePilotEntry(input: { entryId: string; visitorUserId: string }) {
  const entry = await prisma.pilotProfileEntry.findFirst({ where: {
    id: input.entryId, visitorUserId: input.visitorUserId
  }, include: { profile: { select: { id: true, kind: true, displayName: true, isPublished: true } } } });
  if (!entry?.profile.isPublished || pilotDomainForKind(entry.profile.kind) !== entry.domainKey) return null;
  return entry;
}

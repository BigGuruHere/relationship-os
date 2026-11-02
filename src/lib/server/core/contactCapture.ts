// One ingress adapter onto Core Contacts. A submission is unverified self-reported information, not identity proof.
import { error, isHttpError } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { captureFailureMetadata } from './contactCaptureDiagnostics';
import { prisma } from '$lib/db';
import { buildScopedIndexToken, encrypt } from '$lib/crypto';
import { createCoreContact, validateContactDetails } from './contacts';
import { ensurePrivatePeopleSpace } from './myPeople';
import { createWorkspaceCoreAccess } from './accessPolicy';
import { currentWorkspaceCustody, runWithCrossOwnerWorkspaceCustody, runWithExternalWorkspaceCustody, runWithWorkspaceCustody } from './contextSpace';
export const CAPTURE_CHANNEL = 'CONTACT_CAPTURE';
export const CAPTURE_CONSENT_VERSION = 'private-contact-share-v1';
const visitorLimits = new Map<string, { at: number; count: number }>();
export async function publishedCaptureProfile(slug: string) {
  const profile = await prisma.profile.findFirst({ where: { slug, isPublished: true },
    select: { id: true, userId: true, slug: true, kind: true, displayName: true, headline: true, avatarUrl: true } });
  if (!profile) throw error(404, 'Profile unavailable.');
  return profile;
}
export async function capturePrivateContact(profile: Awaited<ReturnType<typeof publishedCaptureProfile>>, input: {
  name: unknown; email?: unknown; phone?: unknown; nonce: string; browser: string; via: 'qr' | 'event' | 'profile_link';
}) {
  const details = validateContactDetails(input);
  const prefix = `contact-capture:v1:${profile.id}:`;
  const externalRef = prefix + buildScopedIndexToken(input.nonce, 'contact-capture:receipt:v1');
  let stage = 'private_home';
  try {
    const space = await ensurePrivatePeopleSpace(profile.userId);
    const context = createWorkspaceCoreAccess(profile.userId, 'public:contact-capture', space.id);
    const execute = async () => {
      stage = 'transaction_start';
      return prisma.$transaction(async tx => {
      // Serialize per profile for atomic retry handling and a cluster-wide submission cap.
      // No phone/email match, update, account creation or reciprocal write is allowed in this boundary.
      stage = 'receipt_lock';
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${prefix}, 0))`;
      stage = 'publication_check';
      const stillPublished = await tx.profile.findFirst({ where: { id: profile.id, userId: profile.userId, isPublished: true }, select: { id: true } });
      if (!stillPublished) throw error(404, 'Profile unavailable.');
      const where = { userId: profile.userId, contextSpaceId: space.id, channel: CAPTURE_CHANNEL };
      stage = 'receipt_lookup';
      if (await tx.interaction.findFirst({ where: { ...where, externalRef }, select: { id: true } })) return;
      const now = Date.now();
      const visitorKey = buildScopedIndexToken(profile.id + ':' + input.browser, 'contact-capture:rate:v1');
      for (const [key, item] of visitorLimits) if (now - item.at > 3600000) visitorLimits.delete(key);
      const recent = visitorLimits.get(visitorKey) ?? { at: now, count: 0 };
      stage = 'rate_check';
      if (visitorLimits.size >= 10000 || recent.count >= 10 || await tx.interaction.count({ where: {
        ...where, externalRef: { startsWith: prefix }, occurredAt: { gte: new Date(now - 3600000) }
      } }) >= 100) throw error(429, 'Please try again later.');
      visitorLimits.set(visitorKey, { at: recent.at, count: recent.count + 1 });
      stage = 'contact_create';
      const contact = await createCoreContact(context, { ...details, sourceProfileId: profile.id }, tx);
      const submittedAt = new Date(now);
      stage = 'provenance_create';
      await tx.interaction.create({ data: {
        userId: profile.userId, contextSpaceId: space.id, contactId: contact.id,
        channel: CAPTURE_CHANNEL, sourceType: 'API', luAdmission: 'STORED_ONLY', externalRef, occurredAt: submittedAt,
        rawTextEnc: encrypt(JSON.stringify({ version: 1, kind: 'CONTACT_CAPTURE', profileId: profile.id,
          profileKind: profile.kind, captureChannel: 'PROFILE_DETAILS_FORM', entryHint: input.via,
          entryHintAssurance: 'UNVERIFIED_LINK_HINT', submittedAt: submittedAt.toISOString(),
          identityStatus: 'UNVERIFIED_SELF_SUBMISSION', submittedFields: ['name', ...(details.email ? ['email'] : []), ...(details.phone ? ['phone'] : [])],
          consent: { version: CAPTURE_CONSENT_VERSION, purpose: 'PRIVATE_CONTACT_AND_FOLLOWUP', acceptedAt: submittedAt.toISOString() }
        }), 'interaction.raw_text')
      } });
      stage = 'transaction_commit';
    });
    };
    stage = 'custody_entry';
    const current = currentWorkspaceCustody();
    if (!current) return await runWithExternalWorkspaceCustody({ targetUserId: profile.userId, targetContextSpaceId: space.id, reason: 'PUBLIC_CONTACT_CAPTURE' }, execute);
    if (current.userId === profile.userId) return await runWithWorkspaceCustody({ userId: profile.userId, contextSpaceId: space.id }, execute);
    // Signed-in visitors have the same public-only authority, never broader access to the recipient's data.
    return await runWithCrossOwnerWorkspaceCustody({ sourceUserId: current.userId, targetUserId: profile.userId,
      targetContextSpaceId: space.id, reason: 'PUBLIC_CONTACT_CAPTURE' }, execute);
  } catch (failure) {
    if (isHttpError(failure)) throw failure;
    const reference = randomUUID();
    // Never print Prisma messages/meta/query parameters: they can contain submitted PII.
    console.error(JSON.stringify({ component: 'relish.contact_capture', stage, timestamp: new Date().toISOString(), reference, ...captureFailureMetadata(failure) }));
    const safe = new Error('Contact capture storage failed');
    Object.assign(safe, { captureReference: reference });
    throw safe;
  }
}

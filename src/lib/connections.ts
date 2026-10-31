// src/lib/connections.ts
// PURPOSE: create a mutual connection between two users by inserting contacts on both sides.
// SECURITY:
// - All PII written to Contact uses AES-256-GCM encrypt() helpers.
// - Equality lookups use deterministic HMAC buildIndexToken().
// - Stage 8.7 permits the profile-owner write only through a named cross-custody boundary.
// BEHAVIOR:
// - Does not require profiles to exist. Falls back to a minimal linked contact.
// - Idempotent: if a contact already exists with linkedUserId it will not create a duplicate.
// - Best effort enrichment from the other user's default profile if present.

import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { requireUserPersonId } from '$lib/server/core/identity';
import {
  currentWorkspaceCustody,
  requireConfiguredDefaultContextSpaceIdForOwner,
  runWithCrossOwnerWorkspaceCustody
} from '$lib/server/core/contextSpace';

// IT: small helper to fetch a user's best profile for enrichment.
async function getBestProfile(userId: string) {
  return prisma.profile.findFirst({
    where: { userId },
    select: {
      displayName: true,
      emailPublic: true,
      phonePublic: true,
      company: true,
      title: true
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
}

// IT: Build a safe Contact payload using only the other user's public profile fields.
function buildContactData(
  ownerId: string,
  ownerContextSpaceId: string,
  otherUserId: string,
  otherPersonId: string,
  prof: Awaited<ReturnType<typeof getBestProfile>> | null
) {
  const displayName = prof?.displayName?.trim() || '';
  const email = prof?.emailPublic?.trim().toLowerCase() || '';
  const phone = prof?.phonePublic?.trim() || '';
  const company = prof?.company?.trim() || '';
  const title = prof?.title?.trim() || '';

  const data: any = {
    userId: ownerId,
    contextSpaceId: ownerContextSpaceId,
    // IT: linkedUserId remains the Stage 7 compatibility bridge; personId is canonical identity.
    linkedUserId: otherUserId,
    personId: otherPersonId
  };

  if (displayName) {
    data.fullNameEnc = encrypt(displayName, 'contact.full_name');
    data.fullNameIdx = buildIndexToken(displayName);
  } else {
    data.fullNameEnc = encrypt('New connection', 'contact.full_name');
    data.fullNameIdx = buildIndexToken('New connection');
  }

  if (email) {
    data.emailEnc = encrypt(email, 'contact.email');
    data.emailIdx = buildIndexToken(email);
  }
  if (phone) {
    data.phoneEnc = encrypt(phone, 'contact.phone');
    data.phoneIdx = buildIndexToken(phone);
  }
  if (company) {
    data.companyEnc = encrypt(company, 'contact.company');
    data.companyIdx = buildIndexToken(company);
  }
  if (title) {
    data.positionEnc = encrypt(title, 'contact.position');
    data.positionIdx = buildIndexToken(title);
  }

  return data;
}

async function ensureLinkedContact(
  tx: any,
  ownerId: string,
  ownerContextSpaceId: string,
  otherUserId: string,
  otherPersonId: string,
  prof: Awaited<ReturnType<typeof getBestProfile>> | null
) {
  const existing = await tx.contact.findFirst({
    where: { userId: ownerId, contextSpaceId: ownerContextSpaceId, linkedUserId: otherUserId },
    select: { id: true, personId: true }
  });

  if (existing) {
    if (existing.personId !== otherPersonId) {
      await tx.contact.update({
        where: { id: existing.id, userId: ownerId, contextSpaceId: ownerContextSpaceId },
        data: { personId: otherPersonId }
      });
    }
    return false;
  }

  try {
    await tx.contact.create({
      data: buildContactData(ownerId, ownerContextSpaceId, otherUserId, otherPersonId, prof)
    });
    return true;
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err;
    const again = await tx.contact.findFirst({
      where: { userId: ownerId, contextSpaceId: ownerContextSpaceId, linkedUserId: otherUserId },
      select: { id: true }
    });
    if (!again) throw err;
    return false;
  }
}

/**
 * IT: Create mutual contacts after a logged-in user connects from another user's public profile.
 * The initiating user's side stays in active custody. The profile owner's side is the one deliberate
 * cross-owner write and is wrapped by PUBLIC_PROFILE_CONNECTION authority.
 */
export async function createMutualConnection(profileOwnerUserId: string, initiatingUserId: string) {
  if (!profileOwnerUserId || !initiatingUserId || profileOwnerUserId === initiatingUserId) {
    throw new Error('Invalid user ids for mutual connection');
  }

  const source = currentWorkspaceCustody();
  if (!source || source.userId !== initiatingUserId) {
    throw new Error('Mutual connection must run inside the initiating user workspace custody.');
  }

  const [profileOwnerProfile, initiatingProfile, profileOwnerPersonId, initiatingPersonId, profileOwnerContextSpaceId] = await Promise.all([
    getBestProfile(profileOwnerUserId),
    getBestProfile(initiatingUserId),
    requireUserPersonId(profileOwnerUserId),
    requireUserPersonId(initiatingUserId),
    requireConfiguredDefaultContextSpaceIdForOwner(prisma as any, profileOwnerUserId)
  ]);

  // SECURITY: Once a profile owner has more than one ContextSpace this compatibility flow fails
  // before writing anything, because Stage 8.7 deliberately refuses to guess the destination.
  const initiatingContextSpaceId = source.contextSpaceId;

  return prisma.$transaction(async (tx) => {
    const createdForProfileOwner = await runWithCrossOwnerWorkspaceCustody(
      {
        sourceUserId: initiatingUserId,
        targetUserId: profileOwnerUserId,
        targetContextSpaceId: profileOwnerContextSpaceId,
        reason: 'PUBLIC_PROFILE_CONNECTION'
      },
      () => ensureLinkedContact(
        tx,
        profileOwnerUserId,
        profileOwnerContextSpaceId,
        initiatingUserId,
        initiatingPersonId,
        initiatingProfile
      )
    );

    const createdForInitiator = await ensureLinkedContact(
      tx,
      initiatingUserId,
      initiatingContextSpaceId,
      profileOwnerUserId,
      profileOwnerPersonId,
      profileOwnerProfile
    );

    return {
      createdAny: createdForProfileOwner || createdForInitiator,
      createdForProfileOwner,
      createdForInitiator
    };
  });
}


/**
 * IT: Network connection path. Both contact copies are explicitly in their owners' General
 * ContextSpaces, never in the caller's default Business workspace. The original public-profile
 * compatibility connection remains unchanged for non-Network profiles.
 */
export async function createNetworkConnection(profileId: string, profileOwnerUserId: string, initiatingUserId: string) {
  if (!profileId || !profileOwnerUserId || !initiatingUserId || profileOwnerUserId === initiatingUserId) {
    throw new Error('Invalid Network connection participants.');
  }
  const source = currentWorkspaceCustody();
  if (!source || source.userId !== initiatingUserId) {
    throw new Error('Network connection requires the initiating user workspace.');
  }
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: profileOwnerUserId, kind: 'personal' },
    select: { id: true }
  });
  if (!profile) throw new Error('Personal invitation profile does not exist.');

  const [ownerGeneral, visitorGeneral, ownerProfile, visitorProfile, ownerPersonId, visitorPersonId] = await Promise.all([
    prisma.contextSpace.findFirst({ where: { ownerUserId: profileOwnerUserId, domainKey: 'general' }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], select: { id: true } }),
    prisma.contextSpace.findFirst({ where: { id: source.contextSpaceId, ownerUserId: initiatingUserId, domainKey: 'general' }, select: { id: true } }),
    prisma.profile.findFirst({ where: { id: profileId }, select: { displayName: true, emailPublic: true, phonePublic: true, company: true, title: true } }),
    prisma.profile.findFirst({ where: { userId: initiatingUserId, kind: 'personal' }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }], select: { displayName: true, emailPublic: true, phonePublic: true, company: true, title: true } }),
    requireUserPersonId(profileOwnerUserId),
    requireUserPersonId(initiatingUserId)
  ]);
  if (!ownerGeneral || !visitorGeneral || source.contextSpaceId !== visitorGeneral.id) {
    throw new Error('Both participants must have a General ContextSpace; the visitor must connect within Network.');
  }

  return prisma.$transaction(async (tx) => {
    const createdForOwner = await runWithCrossOwnerWorkspaceCustody({
      sourceUserId: initiatingUserId,
      targetUserId: profileOwnerUserId,
      targetContextSpaceId: ownerGeneral.id,
      reason: 'PUBLIC_PROFILE_CONNECTION'
    }, () => ensureLinkedContact(tx, profileOwnerUserId, ownerGeneral.id, initiatingUserId, visitorPersonId, visitorProfile));
    const createdForVisitor = await ensureLinkedContact(tx, initiatingUserId, visitorGeneral.id, profileOwnerUserId, ownerPersonId, ownerProfile);
    // IT: The unique pair is an idempotency key. Retain original profile attribution
    // when the same visitor reconnects, including a second scan of the QR code.
    const origin = await tx.networkConnectionOrigin.upsert({
      where: { inviterUserId_visitorUserId: { inviterUserId: profileOwnerUserId, visitorUserId: initiatingUserId } },
      create: {
        inviterUserId: profileOwnerUserId,
        visitorUserId: initiatingUserId,
        profileId,
        inviterContextSpaceId: ownerGeneral.id,
        visitorContextSpaceId: visitorGeneral.id
      },
      update: {},
      select: { id: true }
    });
    return { createdAny: createdForOwner || createdForVisitor, originId: origin.id };
  });
}

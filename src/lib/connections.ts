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
  requireSingleContextSpaceIdForOwner,
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
    requireSingleContextSpaceIdForOwner(prisma as any, profileOwnerUserId)
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

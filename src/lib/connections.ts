// src/lib/connections.ts
// PURPOSE: create a mutual connection between two users by inserting contacts on both sides
// SECURITY:
// - All PII written to Contact uses AES-256-GCM encrypt() helpers
// - Equality lookups use deterministic HMAC buildIndexToken()
// BEHAVIOR:
// - Does not require profiles to exist. Falls back to minimal linked contact.
// - Idempotent: if a contact already exists with linkedUserId it will not create a duplicate.
// - Best effort enrichment from the other user's default profile if present.

import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';

// IT: small helper to fetch a user's best profile for enrichment
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

// IT: build a safe contact payload using any available public profile fields
function buildContactData(ownerId: string, otherUserId: string, prof: Awaited<ReturnType<typeof getBestProfile>> | null) {
  const displayName = prof?.displayName?.trim() || '';
  const email = prof?.emailPublic?.trim().toLowerCase() || '';
  const phone = prof?.phonePublic?.trim() || '';
  const company = prof?.company?.trim() || '';
  const title = prof?.title?.trim() || '';

  const data: any = {
    userId: ownerId,
    // IT: we always link the other user for reciprocity and de-duplication
    linkedUserId: otherUserId
  };

  // IT: only set encrypted fields when we have something to store
  if (displayName) {
    data.fullNameEnc = encrypt(displayName, 'contact.full_name');
    data.fullNameIdx = buildIndexToken(displayName);
  } else {
    // IT: minimal placeholder name to avoid empty UI cards
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

/**
 * IT: Create mutual contacts for A and B. Idempotent and profile-agnostic.
 * - For A: create a Contact where userId = A and linkedUserId = B if missing.
 * - For B: create a Contact where userId = B and linkedUserId = A if missing.
 */
export async function createMutualConnection(userAId: string, userBId: string) {
  if (!userAId || !userBId || userAId === userBId) {
    throw new Error('Invalid user ids for mutual connection');
  }

  // IT: fetch profiles in parallel - can be null
  const [profA, profB] = await Promise.all([getBestProfile(userAId), getBestProfile(userBId)]);

  // IT: run inside a transaction to reduce race windows
  await prisma.$transaction(async (tx) => {
    // A side - does A already have B as a contact
    const aHasB = await tx.contact.findFirst({
      where: { userId: userAId, linkedUserId: userBId },
      select: { id: true }
    });

    if (!aHasB) {
      const payloadA = buildContactData(userAId, userBId, profB);
      try {
        await tx.contact.create({ data: payloadA });
      } catch (err: any) {
        // IT: tolerate unique collisions on emailIdx or phoneIdx by re-checking the linkedUserId pair
        if (err?.code !== 'P2002') throw err;
        const again = await tx.contact.findFirst({
          where: { userId: userAId, linkedUserId: userBId },
          select: { id: true }
        });
        if (!again) throw err;
      }
    }

    // B side - does B already have A as a contact
    const bHasA = await tx.contact.findFirst({
      where: { userId: userBId, linkedUserId: userAId },
      select: { id: true }
    });

    if (!bHasA) {
      const payloadB = buildContactData(userBId, userAId, profA);
      try {
        await tx.contact.create({ data: payloadB });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
        const again = await tx.contact.findFirst({
          where: { userId: userBId, linkedUserId: userAId },
          select: { id: true }
        });
        if (!again) throw err;
      }
    }
  });
}

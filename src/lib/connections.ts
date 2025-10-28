// src/lib/connections.ts
// PURPOSE: create bidirectional contacts when two Relish users connect
// SECURITY: all queries are tenant scoped - encrypts PII server side only
// NOTES: all IT code is commented and uses normal hyphens

import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';

/**
 * Create bidirectional contacts between two users using their profile data.
 * @param userAId - first user's id (typically the profile owner)
 * @param userBId - second user's id (typically the visitor)
 */
export async function createMutualConnection(userAId: string, userBId: string) {
  // IT: get default profiles for both users
  const [profileA, profileB] = await Promise.all([
    getDefaultProfile(userAId),
    getDefaultProfile(userBId)
  ]);

  if (!profileA || !profileB) {
    throw new Error('Both users must have profiles to connect');
  }

  // IT: create contact in A's tenant for B
  await createContactFromProfile(userAId, profileB, userBId);

  // IT: create contact in B's tenant for A
  await createContactFromProfile(userBId, profileA, userAId);
}

/**
 * Get a user's default or most recent profile.
 */
async function getDefaultProfile(userId: string) {
  return prisma.profile.findFirst({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      company: true,
      title: true,
      emailPublic: true,
      phonePublic: true,
      websiteUrl: true
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
}

/**
 * Create a Contact in one user's tenant from another user's profile.
 * @param ownerId - tenant owner who will own this contact
 * @param profile - profile data to populate the contact
 * @param linkedUserId - the user id this contact represents (for linking)
 */
async function createContactFromProfile(
  ownerId: string,
  profile: {
    displayName: string | null;
    company: string | null;
    title: string | null;
    emailPublic: string | null;
    phonePublic: string | null;
    websiteUrl: string | null;
  },
  linkedUserId: string
) {
  // IT: prepare encrypted fields with safe fallbacks
  const name = profile.displayName?.trim() || 'Relish User';

  const data: any = {
    userId: ownerId,
    linkedUserId, // IT: marks this as a Relish user connection
    fullNameEnc: encrypt(name, 'contact.full_name'),
    fullNameIdx: buildIndexToken(name)
  };

  // IT: optional fields - only set if present
  if (profile.emailPublic) {
    data.emailEnc = encrypt(profile.emailPublic, 'contact.email');
    data.emailIdx = buildIndexToken(profile.emailPublic);
  }

  if (profile.phonePublic) {
    data.phoneEnc = encrypt(profile.phonePublic, 'contact.phone');
    data.phoneIdx = buildIndexToken(profile.phonePublic);
  }

  if (profile.company) {
    data.companyEnc = encrypt(profile.company, 'contact.company');
    data.companyIdx = buildIndexToken(profile.company);
  }

  if (profile.title) {
    data.positionEnc = encrypt(profile.title, 'contact.position');
  }

  // IT: best effort create - ignore if duplicate by email/phone
  try {
    await prisma.contact.create({ data });
  } catch (err: any) {
    // IT: P2002 is unique constraint violation - likely duplicate email
    if (err?.code === 'P2002') {
      console.warn('Contact already exists, skipping:', { ownerId, linkedUserId });
      return;
    }
    throw err;
  }
}
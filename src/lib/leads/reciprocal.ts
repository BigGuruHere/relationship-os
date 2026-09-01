// PURPOSE: when a pending lead is claimed, create or identity-link a reciprocal Contact in the new user's tenant
// PRIVACY: uses only the owner's public Profile fields - no private data
// SECURITY: encrypts PII, uses deterministic indexes, and preserves tenant ownership by recipient userId

import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { requireUserPersonId } from '$lib/server/core/identity';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';

export async function createReciprocalContactIfMissing(recipientUserId: string, ownerUserId: string) {
  // IT: Stage 8.1 canonical identity for the account being represented in this workspace.
  const ownerPersonId = await requireUserPersonId(ownerUserId);
  // SECURITY: Stage 8.7 requires this helper to run in the recipient's active custody. The other
  // user's Profile is account-level public data, while all Contact reads/writes stay with the recipient.
  const recipientContextSpaceId = contextSpaceIdForOwner(recipientUserId);

  // IT: if the explicit account link already exists, make sure its Person bridge is also populated.
  const linked = await prisma.contact.findFirst({
    where: { userId: recipientUserId, contextSpaceId: recipientContextSpaceId, linkedUserId: ownerUserId },
    select: { id: true, personId: true }
  });
  if (linked) {
    if (linked.personId !== ownerPersonId) {
      await prisma.contact.update({ where: { id: linked.id, userId: recipientUserId, contextSpaceId: recipientContextSpaceId }, data: { personId: ownerPersonId } });
    }
    return;
  }

  // IT: fetch owner's default or most recent profile to get public fields
  const prof = await prisma.profile.findFirst({
    where: { userId: ownerUserId },
    select: {
      displayName: true,
      emailPublic: true,
      phonePublic: true,
      company: true,
      title: true
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });

  if (!prof) return; // nothing public to import

  const fullName = (prof.displayName || '').trim();
  const email = (prof.emailPublic || '').trim();
  const phone = (prof.phonePublic || '').trim();
  const company = (prof.company || '').trim();

  // IT: if no visible info, skip
  if (!fullName && !email && !phone) return;

  // IT: try to find an existing contact in recipient tenant by deterministic email or phone.
  // If found, reuse that workspace Contact and attach the canonical Person instead of creating a duplicate.
  const byEmail = email
    ? await prisma.contact.findFirst({
        where: { userId: recipientUserId, contextSpaceId: recipientContextSpaceId, emailIdx: buildIndexToken(email) },
        select: { id: true }
      })
    : null;

  const byPhone = !byEmail && phone
    ? await prisma.contact.findFirst({
        where: { userId: recipientUserId, contextSpaceId: recipientContextSpaceId, phoneIdx: buildIndexToken(phone) },
        select: { id: true }
      })
    : null;

  const existing = byEmail ?? byPhone;
  if (existing) {
    await prisma.contact.update({
      where: { id: existing.id, userId: recipientUserId, contextSpaceId: recipientContextSpaceId },
      data: { linkedUserId: ownerUserId, personId: ownerPersonId }
    });
    return;
  }

  // IT: create minimal contact in recipient tenant using public fields
  const data: any = {
    userId: recipientUserId,
    contextSpaceId: recipientContextSpaceId,
    linkedUserId: ownerUserId,
    personId: ownerPersonId
  };

  if (fullName) {
    data.fullNameEnc = encrypt(fullName, 'contact.full_name');
    data.fullNameIdx = buildIndexToken(fullName);
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

  // IT: best effort create - ignore unique collisions silently
  try {
    await prisma.contact.create({ data });
  } catch (e: any) {
    if (!(e?.code === 'P2002')) throw e;
  }
}

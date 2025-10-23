// PURPOSE: when a pending lead is claimed, create a reciprocal Contact in the new user's tenant
// PRIVACY: uses only the owner's public Profile fields - no private data
// SECURITY: encrypts PII and uses deterministic indexes - tenant scoped by recipient userId

import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';

export async function createReciprocalContactIfMissing(recipientUserId: string, ownerUserId: string) {
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

  // IT: try to find an existing contact in recipient tenant by deterministic email or phone
  const byEmail = email
    ? await prisma.contact.findFirst({
        where: { userId: recipientUserId, emailIdx: buildIndexToken(email) },
        select: { id: true }
      })
    : null;

  const byPhone = !byEmail && phone
    ? await prisma.contact.findFirst({
        where: { userId: recipientUserId, phoneIdx: buildIndexToken(phone) },
        select: { id: true }
      })
    : null;

  if (byEmail || byPhone) return; // already present

  // IT: create minimal contact in recipient tenant using public fields
  const data: any = {
    userId: recipientUserId
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

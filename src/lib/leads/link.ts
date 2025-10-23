// PURPOSE: link pending leads to a newly authenticated user by email index
// SECURITY: uses deterministic HMAC indexes - no plaintext PII

import { prisma } from '$lib/db';
import { buildIndexToken } from '$lib/crypto';
import { createReciprocalContactIfMissing } from './reciprocal';


export async function linkLeadsForUser(userId: string, userEmail: string) {
  // IT: compute the deterministic equality index for the verified email
  const emailIdx = buildIndexToken(userEmail);

  // IT: find pending leads for this email
  const leads = await prisma.lead.findMany({
    where: { emailIdx, status: 'PENDING' },
    select: { id: true, contactId: true }
  });
  if (leads.length === 0) return;

  // IT: claim them and link their contacts to this platform user
  await prisma.$transaction(
    leads.flatMap((lead) => [
      prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'CLAIMED', claimedByUserId: userId }
      }),
      prisma.contact.update({
        where: { id: lead.contactId },
        data: { linkedUserId: userId }
      })
    ])
  );
  const claimed = await prisma.lead.findMany({
    where: { emailIdx: buildIndexToken(userEmail), status: 'CLAIMED', claimedByUserId: userId },
    select: { ownerId: true }
  });

  // IT: dedupe owners and create reciprocal contact once per owner
  const owners = Array.from(new Set(claimed.map((l) => l.ownerId)));
  for (const ownerId of owners) {
    try {
      await createReciprocalContactIfMissing(userId, ownerId);
    } catch {
      // never block login
    }
  }
}

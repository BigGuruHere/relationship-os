// src/lib/server/names.ts
// PURPOSE: choose a friendly display name without requiring a profile
// SECURITY: decrypts only server side

import { prisma } from '$lib/db';
import { decryptUserEmail } from '$lib/server/userEmail';

export async function getBestDisplayName(userId: string): Promise<string> {
  // IT: prefer the user's profile display name
  const prof = await prisma.profile.findFirst({
    where: { userId },
    select: { displayName: true },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
  const name = prof?.displayName?.trim();
  if (name) return name;

  // IT: fallback to email local-part
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email_Enc: true }
  });
  const emailPlain = decryptUserEmail(u?.email_Enc ?? null) || '';
  const local = emailPlain.split('@')[0]?.trim();
  if (local) return local;

  return 'Relish user';
}

// src/lib/server/userEmail.ts
// PURPOSE: Centralize email set/get and lookup using encrypted email fields.
// SECURITY: Only server code should import this. Never expose decrypted email to client JS.

import { prisma } from '$lib/db';
import { normalizeEmail, detHmac, encryptText, decryptText } from '$lib/crypto';

export async function setUserEmail(userId: string, email: string) {
  const norm = normalizeEmail(email);
  const email_Idx = detHmac(norm);
  const email_Enc = encryptText(norm);
  return prisma.user.update({
    where: { id: userId },
    data: { email_Idx, email_Enc }
  });
}

export async function findUserByEmail(email: string) {
  const norm = normalizeEmail(email);
  const email_Idx = detHmac(norm);
  return prisma.user.findUnique({ where: { email_Idx } });
}

export function decryptUserEmail(email_Enc?: string | null) {
  if (!email_Enc) return null;
  return decryptText(email_Enc);
}

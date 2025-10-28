// src/lib/server/userEmail.ts
// PURPOSE - Centralize encrypted email set/get and equality lookup for User.
// SECURITY - Server-only. Normalizes email before HMAC and AES-256-GCM.
//           Never expose decrypted email to client JS. Only decrypt when needed for server tasks.

import { prisma } from '$lib/db';
import * as cryptoLib from '$lib/crypto';

// IT - toggle based on your Prisma schema type for User.email_Idx
// - true  - email_Idx is Bytes @unique
// - false - email_Idx is String @unique (hex)
const USE_BYTES_INDEX = true;

// IT - pick up functions from your crypto module with safe fallbacks
const normalizeEmail =
  (cryptoLib as any).normalizeEmail ||
  ((s: string) => s.normalize('NFC').trim().toLowerCase());

const encrypt: (pt: string, aad?: string) => string =
  (cryptoLib as any).encrypt;

const decrypt: (payload: string, aad?: string) => string =
  // IT - some older files used decrypt instead of decryptText - prefer decrypt
  (cryptoLib as any).decrypt;

// IT - support either bytes or hex index builders, plus legacy buildIndexToken(hex)
const buildEmailIndexBytes: ((s: string) => Buffer) | undefined =
  (cryptoLib as any).buildEmailIndexBytes;

const buildEmailIndexHex: ((s: string) => string) | undefined =
  (cryptoLib as any).buildEmailIndexHex;

// IT - legacy name for hex HMAC index
const buildIndexToken: ((s: string) => string) | undefined =
  (cryptoLib as any).buildIndexToken;

// IT - derive the correct index value for your schema
function toEmailIdx(inputEmail: string) {
  const norm = normalizeEmail(inputEmail);

  if (USE_BYTES_INDEX) {
    // Bytes column path
    if (buildEmailIndexBytes) return buildEmailIndexBytes(norm);
    // Fallback - build hex and convert to bytes
    const hex =
      (buildEmailIndexHex && buildEmailIndexHex(norm)) ||
      (buildIndexToken && buildIndexToken(norm));
    if (!hex) throw new Error('No email index function available');
    return Buffer.from(hex, 'hex');
  }

  // String hex column path
  if (buildEmailIndexHex) return buildEmailIndexHex(norm);
  if (buildIndexToken) return buildIndexToken(norm);
  throw new Error('No email index function available');
}

// IT - write encrypted email and deterministic index
export async function setUserEmail(userId: string, email: string) {
  const norm = normalizeEmail(email);
  const email_Enc = encrypt(norm);
  const email_Idx = toEmailIdx(norm);
  return prisma.user.update({
    where: { id: userId },
    data: { email_Enc, email_Idx }
  });
}

// IT - equality lookup by deterministic index
export async function findUserByEmail(email: string) {
  const email_Idx = toEmailIdx(email);
  // Bytes or String unique both work with where: { email_Idx }
  return prisma.user.findUnique({ where: { email_Idx } });
}

// IT - decrypt when a server-only string is required, such as email sending
export function decryptUserEmail(email_Enc?: string | null) {
  if (!email_Enc) return null;
  return decrypt(email_Enc);
}

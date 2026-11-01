// Shared basic Contact persistence. Applications add workflows, not another Contact store.
import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/db';
import { encrypt, decrypt, buildIndexToken } from '$lib/crypto';
import type { CoreAccessContext } from './accessPolicy';

export function validateContactDetails(input: { name: unknown; email?: unknown; phone?: unknown }) {
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim();
  const phone = String(input.phone ?? '').trim();
  if (!name || name.length > 200) throw new Error('Enter a name of up to 200 characters.');
  if (email && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) throw new Error('Enter a valid email address.');
  // Store what the owner supplied; do not infer a country or treat phone equality as verified identity.
  if (phone && (phone.length > 40 || !/^\+?[0-9() .-]{7,40}$/.test(phone))) throw new Error('Enter a valid phone number.');
  return { name, email, phone };
}

// Shared persistence for basic and commercial adapters. Applications cannot override custody.
export async function persistCoreContact(context: CoreAccessContext, data: Omit<Prisma.ContactUncheckedCreateInput, 'userId' | 'contextSpaceId'>) {
  return prisma.contact.create({ data: { ...data, userId: context.workspaceUserId, contextSpaceId: context.contextSpaceId }, select: { id: true } });
}

export async function createCoreContact(context: CoreAccessContext, input: { name: unknown; email?: unknown; phone?: unknown }) {
  const { name, email, phone } = validateContactDetails(input);
  // Same names are allowed. No account, canonical Person, reciprocal relationship or automatic matching.
  return persistCoreContact(context, {
    fullNameEnc: encrypt(name, 'contact.full_name'), fullNameIdx: buildIndexToken(name),
    emailEnc: email ? encrypt(email, 'contact.email') : null, emailIdx: email ? buildIndexToken(email.toLowerCase()) : null,
    phoneEnc: phone ? encrypt(phone, 'contact.phone') : null, phoneIdx: phone ? buildIndexToken(phone) : null,
    source: 'MANUAL'
  });
}

export function privateContactDetails(row: { id: string; fullNameEnc: string; emailEnc: string | null; phoneEnc: string | null }) {
  return { id: row.id, name: decrypt(row.fullNameEnc, 'contact.full_name'),
    email: row.emailEnc ? decrypt(row.emailEnc, 'contact.email') : '', phone: row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : '' };
}

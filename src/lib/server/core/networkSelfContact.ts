// Stage 8.15.4.6a: Internal compatibility contact for self-directed Network conversations.
// IDENTITY: the authenticated User's Person is canonical; this Contact is NOT another identity.
// CUSTODY: only create within the signed-in owner's verified General ContextSpace.
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';

type Scope = { userId: string; contextSpaceId: string };

export async function ensureNetworkSelfContact({ userId, contextSpaceId }: Scope): Promise<string> {
  const space = await prisma.contextSpace.findFirst({
    where: { id: contextSpaceId, ownerUserId: userId, domainKey: 'general' },
    select: { id: true }
  });
  if (!space) throw new Error('An owned General ContextSpace is required.');

  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { personId: true }
  });
  // Do not invent a new Person or silently attach self conversations to an unrelated Person.
  if (!user?.personId) throw new Error('Canonical Person identity is not initialized.');

  const where = { userId, contextSpaceId, linkedUserId: userId };
  const current = await prisma.contact.findMany({
    where, select: { id: true, personId: true }, take: 2
  });
  if (current.length > 1) throw new Error('Multiple self-contact records require review.');
  if (current.length === 1) {
    if (current[0].personId && current[0].personId !== user.personId) {
      throw new Error('Self-contact points to a different Person identity.');
    }
    if (!current[0].personId) {
      await prisma.contact.update({ where: { id: current[0].id }, data: { personId: user.personId } });
    }
    return current[0].id;
  }

  // A public Personal profile is the only optional name source. Never copy private CRM notes.
  const profile = await prisma.profile.findFirst({
    where: { userId, kind: 'personal' },
    orderBy: { updatedAt: 'desc' }, select: { displayName: true }
  });
  const name = profile?.displayName?.trim() || 'Myself';
  try {
    const created = await prisma.contact.create({
      data: {
        userId, contextSpaceId, personId: user.personId, linkedUserId: userId,
        fullNameEnc: encrypt(name, 'contact.full_name'),
        fullNameIdx: buildIndexToken(name), source: 'MANUAL'
      }, select: { id: true }
    });
    return created.id;
  } catch (error: unknown) {
    // Concurrent launch: the existing unique constraint makes provisioning idempotent.
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
    const existing = await prisma.contact.findFirst({ where, select: { id: true, personId: true } });
    if (!existing || existing.personId !== user.personId) throw error;
    return existing.id;
  }
}

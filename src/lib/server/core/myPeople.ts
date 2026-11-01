// My People is deliberately private-home-only in Stage 1. No aggregation or record relocation.
import { createHash } from 'node:crypto';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encryptContextSpaceDisplayName } from './contextSpaceDirectory';
import { createWorkspaceCoreAccess } from './accessPolicy';
import { PRIVATE_DOMAIN_KEY } from './contextDomain';
import { runWithWorkspaceCustody } from './contextSpace';
import { findCoreContact } from './relationshipRepository';

export async function privatePeopleSpace(userId: string) {
  const rows = await prisma.contextSpace.findMany({ where: { ownerUserId: userId, domainKey: PRIVATE_DOMAIN_KEY, kind: 'WORKSPACE' }, select: { id: true }, take: 2 });
  if (rows.length > 1) throw error(409, 'Multiple private storage homes require review.');
  return rows[0] ?? null;
}

export async function ensurePrivatePeopleSpace(userId: string) {
  const existing = await privatePeopleSpace(userId);
  if (existing) return existing;
  // Stable UUID makes concurrent first saves idempotent without a schema change or changing the user's default.
  const hash = createHash('sha256').update('relish:private-people:v1:' + userId).digest('hex');
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  // createMany uses INSERT ... ON CONFLICT; an empty-update Prisma upsert can race.
  await prisma.contextSpace.createMany({ skipDuplicates: true, data: [{
    id, ownerUserId: userId, domainKey: PRIVATE_DOMAIN_KEY, kind: 'WORKSPACE', isDefault: false,
    displayNameEnc: encryptContextSpaceDisplayName('My People')
  }] });
  const row = await prisma.contextSpace.findUniqueOrThrow({ where: { id }, select: { id: true, ownerUserId: true, domainKey: true, kind: true } });
  if (row.ownerUserId !== userId || row.domainKey !== PRIVATE_DOMAIN_KEY || row.kind !== 'WORKSPACE') throw error(403, 'Private storage unavailable.');
  return { id: row.id };
}

export async function requirePeopleAccess(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  const space = await privatePeopleSpace(locals.user.id);
  if (!space || locals.contextDomainKey !== PRIVATE_DOMAIN_KEY || locals.contextSpaceId !== space.id) throw error(404, 'Private workspace not found.');
  return createWorkspaceCoreAccess(locals.user.id, 'people:private', space.id);
}

export async function requirePeopleContact(locals: App.Locals, id: string) {
  const context = await requirePeopleAccess(locals);
  const contact = await findCoreContact(context, id, { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true });
  if (!contact) throw error(404, 'Person not found.');
  return { context, contact };
}

export { runWithWorkspaceCustody };

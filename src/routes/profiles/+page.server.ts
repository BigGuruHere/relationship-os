// Stage 8.16: explicit owner hub, with strict per-kind profile selection.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const profiles = await prisma.profile.findMany({ where: {
    userId: locals.user.id, kind: { in: ['business', 'personal', 'dating'] }
  }, select: { id: true, kind: true, slug: true, displayName: true, headline: true, isPublished: true },
  orderBy: { updatedAt: 'desc' } });
  // Only the owner can read explicitly offered contact details. Never read private LU.
  const requests = await prisma.pilotConnectionRequest.findMany({ where: {
    ownerUserId: locals.user.id, status: 'REQUESTED'
  }, orderBy: { createdAt: 'desc' }, take: 100 });
  // Prefer the last edited of each kind without inventing or merging profiles.
  return { requests: requests.map(request => ({
    id: request.id, domainKey: request.domainKey,
    name: decrypt(request.nameEnc, 'pilot.connection.name'),
    email: decrypt(request.emailEnc, 'pilot.connection.email'),
    requestedAt: request.createdAt.toISOString()
  })), profiles: ['business','personal','dating'].map(kind => ({ kind,
    profile: profiles.find(p => p.kind === kind) || null })) };
};

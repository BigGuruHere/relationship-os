// Profile manager: list every owned profile instead of collapsing to one record per kind.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const profiles = await prisma.profile.findMany({ where: {
    userId: locals.user.id
  }, select: { id: true, kind: true, label: true, slug: true, displayName: true, headline: true, isPublished: true, isDefault: true },
  orderBy: { updatedAt: 'desc' } });
  // Only the owner can read explicitly offered contact details. Never read private LU.
  const requests = await prisma.pilotConnectionRequest.findMany({ where: {
    ownerUserId: locals.user.id, status: 'REQUESTED'
  }, orderBy: { createdAt: 'desc' }, take: 100 });
  // IT: Keep all owned profiles. Profile kind is a secondary classification, not an identity key.
  return { requests: requests.map(request => ({
    id: request.id, domainKey: request.domainKey,
    name: decrypt(request.nameEnc, 'pilot.connection.name'),
    email: decrypt(request.emailEnc, 'pilot.connection.email'),
    requestedAt: request.createdAt.toISOString()
  })), profiles };
};

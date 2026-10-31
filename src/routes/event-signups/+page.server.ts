// Stage 8.22.5 - Owner-only review of event pilot opt-ins.
// SECURITY: Query is restricted to the logged-in owner before decrypting any PII.
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  // IT: Decrypted signup PII must not be cached in a shared response.
  setHeaders({ 'cache-control': 'private, no-store' });
  const rows = await prisma.relishEventPilotSignup.findMany({
    where: { ownerUserId: locals.user.id },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { id: true, nameEnc: true, emailEnc: true, phoneEnc: true, interestGroup: true, consentAt: true, createdAt: true }
  });
  return { signups: rows.map(row => ({
    id: row.id,
    name: decrypt(row.nameEnc, 'event-pilot.name'),
    email: row.emailEnc ? decrypt(row.emailEnc, 'event-pilot.email') : null,
    phone: row.phoneEnc ? decrypt(row.phoneEnc, 'event-pilot.phone') : null,
    group: row.interestGroup,
    consentAt: row.consentAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  })) };
};

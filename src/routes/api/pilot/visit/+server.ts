// Client-confirmed page render is more meaningful than a server-side link prefetch.
// This is still a visit signal, not proof that a physical QR code was scanned.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { pilotDomainForKind, pilotSource, recordPilotEvent } from '$lib/server/pilot';
export const POST: RequestHandler = async ({ request, locals, url }) => {
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin' }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid body' }, { status: 400 }); }
  const slug = typeof body?.slug === 'string' && body.slug.length <= 120 ? body.slug : '';
  const profile = slug ? await prisma.profile.findUnique({ where: { slug },
    select: { id: true, kind: true, userId: true, isPublished: true } }) : null;
  if (!profile?.isPublished) return json({ error: 'Profile unavailable' }, { status: 404 });
  const domainKey = pilotDomainForKind(profile.kind);
  if (!domainKey) return json({ ok: true });
  const source = pilotSource(body?.via);
  await recordPilotEvent({ type: source === 'qr' ? 'qr.landing_opened' : 'profile.viewed',
    env: locals.env, profileId: profile.id, ownerUserId: profile.userId, domainKey, source });
  return json({ ok: true });
};

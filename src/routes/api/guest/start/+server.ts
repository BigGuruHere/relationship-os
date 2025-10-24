// src/routes/api/guest/start/+server.ts
// PURPOSE: start a lightweight guest flow from the public /u/[slug] page.
// INPUT: form POST with inviteToken.
// ACTIONS:
// - verify the invite token
// - set a short lived, non sensitive cookie with the owner id so the UI can personalize
// - redirect the visitor to the owner's lead form at /u/<slug>/lead
// SECURITY: no privileged session is created here.

import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { verifyInviteToken } from '$lib/server/tokens';
import { redirect } from '@sveltejs/kit';
import { getAppOriginLoose } from '$lib/appOrigin';

const APP_ORIGIN = getAppOriginLoose();

export const POST: RequestHandler = async ({ request, cookies }) => {
  // IT: read form body
  const form = await request.formData();
  const inviteToken = String(form.get('inviteToken') || '');

  if (!inviteToken) {
    // IT: no token provided - send to home
    throw redirect(303, '/');
  }

  // IT: verify the invite token - binds to a specific owner user id
  const payload = await verifyInviteToken(inviteToken);
  if (!payload) {
    throw redirect(303, '/');
  }

  // IT: set a short lived, non sensitive cookie for light UX hints
  cookies.set('connect_owner', payload.ownerId, {
    path: '/',
    maxAge: 60, // one minute
    httpOnly: false,
    sameSite: 'lax'
  });

  // IT: resolve a slug to land on, using a safe priority:
  // 1) explicit profileId if present in payload
  // 2) user's publicSlug if set
  // 3) oldest profile's slug for that user
  let slug: string | null = null;

  // 1) explicit profile id branch
  const metaProfileId = (payload as any).profileId as string | undefined;
  if (metaProfileId) {
    const prof = await prisma.profile.findUnique({
      where: { id: metaProfileId },
      select: { slug: true }
    });
    if (prof?.slug) slug = prof.slug;
  }

  // 2) user.publicSlug branch
  if (!slug) {
    const user = await prisma.user.findUnique({
      where: { id: payload.ownerId },
      select: { publicSlug: true }
    });
    if (user?.publicSlug) slug = user.publicSlug;
  }

  // 3) oldest profile for that user branch
  if (!slug) {
    const oldest = await prisma.profile.findFirst({
      where: { userId: payload.ownerId },
      orderBy: { createdAt: 'asc' },
      select: { slug: true }
    });
    if (oldest?.slug) slug = oldest.slug;
  }

  if (!slug) {
    // IT: no usable slug available - return home quietly
    throw redirect(303, '/');
  }

  // IT: send the visitor to the dedicated lead form for this slug
  const link = `${APP_ORIGIN}/u/${slug}/lead`;
  throw redirect(303, link);
};

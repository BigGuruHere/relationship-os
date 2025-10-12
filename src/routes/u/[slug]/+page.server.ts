// src/routes/u/[slug]/+page.server.ts
// PURPOSE: load owner by slug or id, fetch their default or selected profile, and mint an invite token.
// SECURITY: profile fields are public by design. No decryption in the client.
// All IT code is commented and uses hyphens only.

import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { createInviteToken } from '$lib/server/tokens';

export const load: PageServerLoad = async ({ params, url }) => {
  // 1) resolve owner by slug or id
  const owner = await prisma.user.findFirst({
    where: {
      OR: [{ publicSlug: params.slug }, { id: params.slug }]
    },
    select: { id: true, publicSlug: true }
  });
  if (!owner) {
    return { status: 404 };
  }

  // 2) decide which profile to show
  const v = url.searchParams.get('v');           // business, personal, dating, custom
  const pslug = url.searchParams.get('profile'); // explicit profile slug

  // Guard in case the generated client is not yet updated during dev
  const hasProfileAPI =
    (prisma as any).profile &&
    typeof (prisma as any).profile.findFirst === 'function';

  let profile: any = null;

  if (hasProfileAPI) {
    if (pslug) {
      profile = await prisma.profile.findFirst({
        where: { slug: pslug, userId: owner.id }
      });
    } else if (v) {
      profile = await prisma.profile.findFirst({
        where: { userId: owner.id, kind: v as any }
      });
    } else {
      profile = await prisma.profile.findFirst({
        where: { userId: owner.id, isDefault: true }
      });
    }
  }

  // 3) create an invite token as before
  const invite = await createInviteToken({ ownerId: owner.id, ttlMinutes: 30 });

  // 4) return safe data - profile can be null and the page should render a fallback
  return {
    owner: { id: owner.id, slug: owner.publicSlug ?? params.slug },
    inviteToken: invite.token,
    profile
  };
};

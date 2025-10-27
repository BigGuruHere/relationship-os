// src/routes/thank-you/+page.server.ts
// PURPOSE: server load for the post-share thank you screen - resolves the sharer's display name from the slug in ?ref=
// SECURITY: reads only public profile fields and user.publicSlug - no secrets or decryption

import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';

export const load: PageServerLoad = async ({ url }) => {
  // IT: get the sharer slug from the query string like /thank-you?ref=terence-sweeney
  const ref = url.searchParams.get('ref')?.trim() || null;

  if (!ref) {
    // IT: no ref provided - return a generic label
    return {
      sharerSlug: null,
      sharerName: 'your new contact'
    };
  }

  

  // IT: try to resolve a Profile by slug to get a friendly display name
  const prof = await prisma.profile.findFirst({
    where: { slug: ref },
    select: { displayName: true, slug: true }
  });

  if (prof) {
    return {
      sharerSlug: prof.slug,
      sharerName: prof.displayName?.trim() || 'your new contact'
    };
  }

  // IT: fall back to a user with a matching publicSlug
  const user = await prisma.user.findFirst({
    where: { publicSlug: ref },
    select: { publicSlug: true }
  });

  if (user?.publicSlug) {
    // IT: no profile name available - make a readable label from the slug
    const friendly = ref.replace(/-/g, ' ');
    return {
      sharerSlug: ref,
      sharerName: friendly.charAt(0).toUpperCase() + friendly.slice(1)
    };
  }

  // IT: final fallback
  return {
    sharerSlug: ref,
    sharerName: 'your new contact'
  };
};

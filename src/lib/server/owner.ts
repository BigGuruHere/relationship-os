// src/lib/server/owner.ts
// PURPOSE: resolve an owner's user id and friendly name from a public /u/[slug] value
// SECURITY: read-only lookups - returns only the minimal fields needed by callers

import { prisma } from '$lib/db';

export type ResolvedOwner = {
  id: string;
  publicSlug: string | null;
  displayName: string | null;
};

/** IT: resolve owner by profile.slug first, then user.publicSlug or direct id */
export async function resolveOwnerFromSlug(slug: string): Promise<ResolvedOwner | null> {
  const slugParam = String(slug || '');

  // Try profile.slug first - this also gives us a nice displayName
  const prof = await prisma.profile.findFirst({
    where: { slug: slugParam },
    select: { userId: true, displayName: true }
  });
  if (prof) {
    const user = await prisma.user.findUnique({
      where: { id: prof.userId },
      select: { id: true, publicSlug: true }
    });
    if (user) {
      return {
        id: user.id,
        publicSlug: user.publicSlug || null,
        displayName: prof.displayName || null
      };
    }
  }

  // Fallback to user.publicSlug or direct id
  const user = await prisma.user.findFirst({
    where: { OR: [{ publicSlug: slugParam }, { id: slugParam }] },
    select: { id: true, publicSlug: true }
  });
  if (user) {
    // We do not have a profile match, so no display name to show here
    return { id: user.id, publicSlug: user.publicSlug || null, displayName: null };
  }

  return null;
}

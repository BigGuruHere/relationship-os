// src/lib/server/profile.ts
// PURPOSE: make sure a user has a base profile record to share.
// POLICY: create a simple default profile if the user has none yet.
// SAFETY: guard against a stale Prisma client where prisma.profile is not generated yet.
// All IT code is commented and uses hyphens only.

import { prisma } from '$lib/db';

// Simple random slug for a profile - url friendly
function randSlug(len = 7) {
  return Math.random().toString(36).slice(2, 2 + len);
}

// Check if the generated Prisma client has the Profile API available
function hasProfileAPI(): boolean {
  return Boolean((prisma as any).profile && typeof (prisma as any).profile.findFirst === 'function');
}

/**
 * Ensure there is at least one profile for this user.
 * - If none exists, create a default profile with isDefault = true.
 * - Returns the default profile after provisioning.
 * - If the Prisma client is stale, return a safe placeholder so the UI can render.
 */
export async function ensureBaseProfile(userId: string) {
  // If the client does not know about Profile yet, return a safe placeholder
  if (!hasProfileAPI()) {
    return {
      id: 'placeholder',
      userId,
      slug: 'p-preview',
      isDefault: true,
      displayName: null,
      headline: null,
      bio: null,
      avatarUrl: null,
      company: null,
      title: null,
      websiteUrl: null,
      emailPublic: null,
      phonePublic: null
    };
  }

  // Look for any profile owned by this user
  const existing = await prisma.profile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

  if (existing) {
    // Ensure there is a default - if none, mark the oldest as default
    const def = await prisma.profile.findFirst({
      where: { userId, isDefault: true }
    });
    if (def) return def;

    await prisma.profile.update({
      where: { id: existing.id },
      data: { isDefault: true }
    });

    return await prisma.profile.findFirst({ where: { id: existing.id } });
  }

  // No profile yet - create a simple default one
  const profile = await prisma.profile.create({
    data: {
      userId,
      kind: 'business',
      label: 'My profile',
      slug: `p-${randSlug(7)}`,
      isDefault: true,
      displayName: null,
      headline: null,
      bio: null,
      avatarUrl: null,
      company: null,
      title: null,
      websiteUrl: null,
      emailPublic: null,
      phonePublic: null
    }
  });

  return profile;
}

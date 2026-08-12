// src/lib/server/slug.ts
// PURPOSE: provision a unique random public slug for a user when they first need one.
// SECURITY: server only. Slug is public - no PII here. All IT code is commented.

import { prisma } from '$lib/db';

// Simple random slug - 7 chars from base36
function randomSlug(len = 7): string {
  // Use Math.random for simplicity here - switch to crypto if you prefer
  return Math.random().toString(36).slice(2, 2 + len);
}

/**
 * Ensure the current user has a publicSlug.
 * - If missing, set a random slug.
 * - Retries on unique collisions.
 * - Safe to call many times - returns existing slug if already set.
 */
export async function ensureRandomPublicSlug(userId: string): Promise<string> {
  // If already set, just return it
  const existing = await prisma.user.findFirst({
    where: { id: userId },
    select: { publicSlug: true }
  });
  if (existing?.publicSlug) return existing.publicSlug;

  // Try a few random candidates - handle rare collisions gracefully
  for (let i = 0; i < 10; i++) {
    const slug = randomSlug(7);
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { publicSlug: slug },
        select: { publicSlug: true }
      });
      return updated.publicSlug;
    } catch (err: any) {
      // P2002 means unique collision - try again
      if (err?.code === 'P2002') continue;
      throw err;
    }
  }
  throw new Error('Could not allocate a unique public slug');
}

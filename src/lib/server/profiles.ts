// src/lib/server/profiles.ts
// PURPOSE: guarantee a default profile exists for a user
// SECURITY: server-only - creates minimal public fields with safe defaults

import { prisma } from '$lib/db';
import { randomUUID } from 'node:crypto';

type Seed = {
  displayName?: string | null;
  avatarUrl?: string | null;
  isPublished?: boolean;
};

// Reuse the same defaults for nested signup writes and older accounts missing a profile.
export function defaultProfileData(seed: Seed = {}) {
  return {
    isDefault: true,
    kind: 'business' as const,
    label: 'My profile',
    // Use a non-identifying, globally unique public profile URL slug.
    slug: `p-${randomUUID()}`,
    displayName: seed.displayName || 'New Relish user',
    avatarUrl: seed.avatarUrl || null,
    ...(seed.isPublished === false ? { isPublished: false } : {})
  };
}

export async function ensureDefaultProfile(userId: string, seed: Seed = {}): Promise<string> {
  const existing = await prisma.profile.findFirst({
    where: { userId, isDefault: true },
    select: { id: true }
  });
  if (existing) return existing.id;

  const created = await prisma.profile.create({
    data: { userId, ...defaultProfileData(seed) },
    select: { id: true }
  });
  return created.id;
}

// src/lib/server/profiles.ts
// PURPOSE: guarantee a default profile exists for a user
// SECURITY: server-only - creates minimal public fields with safe defaults

import { prisma } from '$lib/db';

type Seed = {
  displayName?: string | null;
  avatarUrl?: string | null;
};

export async function ensureDefaultProfile(userId: string, seed: Seed = {}): Promise<string> {
  const existing = await prisma.profile.findFirst({
    where: { userId, isDefault: true },
    select: { id: true }
  });
  if (existing) return existing.id;

  const created = await prisma.profile.create({
    data: {
      userId,
      isDefault: true,
      kind: 'business',
      label: 'My profile',
      displayName: seed.displayName || 'New Relish user',
      avatarUrl: seed.avatarUrl || null
      // emailPublic and phonePublic remain null by default
    },
    select: { id: true }
  });
  return created.id;
}

// src/lib/server/core/identity.ts
// PURPOSE: Small identity helpers for Stage 8.1 Person bridging.
// IMPORTANT: Person is identity only. Contact remains the tenant-owned relationship representation.

import type { AppTransactionClient } from '$lib/db';
import { prisma } from '$lib/db';

export async function requireUserPersonId(userId: string, client: Pick<AppTransactionClient, 'user'> = prisma) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { personId: true } });
  if (!user?.personId) throw new Error('User Person identity is not initialized.');
  return user.personId;
}

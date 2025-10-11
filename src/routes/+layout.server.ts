// src/routes/+layout.server.ts
// PURPOSE: Expose current user and a small reconnect-due count to the layout.
// MULTI TENANT: All queries are scoped by userId.
// SAFETY: No PII is decrypted here.

import type { LayoutServerLoad } from './$types';
import { prisma } from '$lib/db';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Comment: expose user to the layout if present
  const user = locals.user ? { id: locals.user.id, email: locals.user.email } : null;

  // Comment: default count when logged out
  let reconnectDue = 0;

  if (locals.user) {
    // Comment: fetch only the minimal fields and compute due in JS for clarity
    const rows = await prisma.contact.findMany({
      where: {
        userId: locals.user.id,
        reconnectEveryDays: { not: null }
      },
      select: { createdAt: true, lastContactedAt: true, reconnectEveryDays: true }
    });

    const now = Date.now();
    reconnectDue = rows.reduce((acc, c) => {
      const days = c.reconnectEveryDays ?? 0;
      if (days <= 0) return acc;

      const baseline = (c.lastContactedAt ?? c.createdAt).getTime();
      const nextDue = baseline + days * 24 * 60 * 60 * 1000;
      return acc + (now >= nextDue ? 1 : 0);
    }, 0);
  }

  return { user, reconnectDue };
};

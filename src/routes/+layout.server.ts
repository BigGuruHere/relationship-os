// src/routes/+layout.server.ts
// PURPOSE: Expose current user, reconnectDue, and remindersOpenCount to the layout.
// MULTI TENANT: All queries are scoped by userId.

import type { LayoutServerLoad } from './$types';
import { prisma } from '$lib/db';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user ? { id: locals.user.id, email: locals.user.email } : null;

  let reconnectDue = 0;
  let remindersOpenCount = 0;

  if (locals.user) {
    // Reconnect due - compute in JS from contact cadence fields
    const rows = await prisma.contact.findMany({
      where: { userId: locals.user.id, reconnectEveryDays: { not: null } },
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

    // Open reminders count - efficient count on server
    remindersOpenCount = await prisma.reminder.count({
      where: { userId: locals.user.id, completedAt: null }
    });
  }

  const actionsCount = (reconnectDue || 0) + (remindersOpenCount || 0);

return {
  user,
  reconnectDue,
  remindersOpenCount,
  actionsCount
};

  return { user, reconnectDue, remindersOpenCount };
};

// src/routes/+layout.server.ts
// PURPOSE: Expose current user info and lightweight counts for the layout.
// SECURITY:
// - Do not expose plaintext email in layout data.
// - If needed for UI, decrypt on the server and pass a redacted string only.
// MULTI TENANT: All queries are scoped by userId.

import type { LayoutServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decryptUserEmail } from '$lib/server/userEmail'; // IT - server-only decrypt helper

// IT - helper to redact an email for safe display
function redactEmail(email: string | null) {
  if (!email) return null;
  // keep first 2 chars and domain, mask the middle
  return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
}

export const load: LayoutServerLoad = async ({ locals }) => {
  // IT - basic shape for layout - only id plus optional redacted email for display
  let user: { id: string; emailRedacted: string | null } | null = null;

  if (locals.user?.id) {
    // IT - read encrypted email for this user and produce a redacted string
    const u = await prisma.user.findUnique({
      where: { id: locals.user.id },
      select: { email_Enc: true }
    });

    const decrypted = decryptUserEmail(u?.email_Enc ?? null);
    user = { id: locals.user.id, emailRedacted: redactEmail(decrypted) };
  }

  // IT - counts for actions in the top bar
  let reconnectDue = 0;
  let remindersOpenCount = 0;

  if (locals.user?.id) {
    // IT - compute reconnects due from cadence fields
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

    // IT - open reminders count
    remindersOpenCount = await prisma.reminder.count({
      where: { userId: locals.user.id, completedAt: null }
    });
  }

  const actionsCount = (reconnectDue || 0) + (remindersOpenCount || 0);

  return {
    user, // { id, emailRedacted } or null
    reconnectDue,
    remindersOpenCount,
    actionsCount
  };
};

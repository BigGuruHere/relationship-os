// src/routes/reconnect/+page.server.ts
// PURPOSE: List contacts that are due to reconnect - due means
// - contact.reconnectEveryDays is set
// - and lastContactedAt is null or older than that cadence window
// MULTI TENANT: Requires login. All queries scoped by userId.
// SECURITY: Decrypt on server only.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

export const load: PageServerLoad = async ({ locals }) => {
  // require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // compute a due threshold per row in JS for readability
  // - we fetch candidates then filter and sort in memory
  const rows = await prisma.contact.findMany({
    where: {
      userId: locals.user.id,
      // only those that opted into cadence
      reconnectEveryDays: { not: null }
    },
    select: {
      id: true,
      createdAt: true,
      lastContactedAt: true,
      reconnectEveryDays: true,
      fullNameEnc: true,
      companyEnc: true
    },
    orderBy: { createdAt: 'asc' } // stable base ordering
  });

  const now = new Date();

  // map to view models with decryption and due calculation
  const due = rows
    .map((c) => {
      // pick a baseline for cadence - prefer lastContactedAt else createdAt
      const baseline = c.lastContactedAt ?? c.createdAt;
      const days = c.reconnectEveryDays ?? 0;

      // next due date is baseline plus cadence
      const nextDue = new Date(baseline.getTime() + days * 24 * 60 * 60 * 1000);

      // compute days overdue - negative means not yet due
      const msOver = now.getTime() - nextDue.getTime();
      const daysOver = Math.floor(msOver / (24 * 60 * 60 * 1000));

      // decrypt safe fields - do not crash on failures
      let name = '(name unavailable)';
      let company: string | null = null;
      try {
        name = decrypt(c.fullNameEnc, 'contact.full_name');
      } catch {}
      try {
        company = c.companyEnc ? decrypt(c.companyEnc, 'contact.company') : null;
      } catch {}

      return {
        id: c.id,
        name,
        company,
        cadenceDays: days,
        lastContactedAt: c.lastContactedAt,
        nextDue,
        daysOver
      };
    })
    // keep only those due today or overdue
    .filter((x) => x.daysOver >= 0)
    // sort by most overdue first
    .sort((a, b) => b.daysOver - a.daysOver || a.name.localeCompare(b.name));

  return { due, now };
};

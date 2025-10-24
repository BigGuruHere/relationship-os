// src/routes/actions/+page.server.ts
// PURPOSE: Load Actions page data - reconnects due and open reminders
// SECURITY: All queries are tenant scoped by locals.user.id. Decrypt only on the server.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto'; // IT: your existing decrypt(bufOrStr, label) helper

export const load: PageServerLoad = async ({ locals }) => {
  // IT: require login
  const user = locals.user;
  if (!user) throw redirect(303, '/auth/login');

  // IT: fetch contacts that have a reconnect cadence configured
  // Your schema uses reconnectEveryDays and lastContactedAt
  const reconnectCandidates = await prisma.contact.findMany({
    where: {
      userId: user.id,
      reconnectEveryDays: { not: null, gt: 0 }
    },
    select: {
      id: true,
      fullNameEnc: true,
      companyEnc: true,
      positionEnc: true,
      lastContactedAt: true,
      reconnectEveryDays: true
    },
    take: 200
  });

  // IT: compute which contacts are actually due based on cadence
  const now = Date.now();
  const dueReconnects = reconnectCandidates
    .filter((c) => {
      const cadence = c.reconnectEveryDays ?? 0;
      const last = c.lastContactedAt ? c.lastContactedAt.getTime() : 0;
      const nextDueAt = last + cadence * 24 * 60 * 60 * 1000;
      return cadence > 0 && now >= nextDueAt;
    })
    .map((c) => {
      // IT: decrypt defensively, never crash the page if a single row fails
      let name = '(name unavailable)';
      let company: string | null = null;
      let position: string | null = null;
      try { if (c.fullNameEnc) name = decrypt(c.fullNameEnc, 'contact.full_name'); } catch {}
      try { if (c.companyEnc) company = decrypt(c.companyEnc, 'contact.company'); } catch {}
      try { if (c.positionEnc) position = decrypt(c.positionEnc, 'contact.position'); } catch {}
      return {
        id: c.id,
        displayName: name,
        company,
        position
      };
    });

  // IT: load open reminders - your model uses note and completedAt
  const rows = await prisma.reminder.findMany({
    where: { userId: user.id, completedAt: null },
    select: {
      id: true,
      dueAt: true,
      note: true,
      contactId: true,
      contact: {
        select: {
          fullNameEnc: true,
          companyEnc: true
        }
      }
    },
    orderBy: { dueAt: 'asc' }
  });

  // IT: decrypt minimal contact info for display
  const reminders = rows.map((r) => {
    let contactName = '(name unavailable)';
    let company: string | null = null;
    try { if (r.contact.fullNameEnc) contactName = decrypt(r.contact.fullNameEnc, 'contact.full_name'); } catch {}
    try { if (r.contact.companyEnc) company = decrypt(r.contact.companyEnc, 'contact.company'); } catch {}
    return {
      id: r.id,
      dueAt: r.dueAt,
      note: r.note || '',
      contactId: r.contactId,
      contactName,
      company
    };
  });

  // IT: counts for header badge
  const reconnectDue = dueReconnects.length;
  const remindersOpenCount = reminders.length;
  const actionsCount = reconnectDue + remindersOpenCount;

  return {
    reconnectDue,
    remindersOpenCount,
    actionsCount,
    dueReconnects,
    reminders
  };
};

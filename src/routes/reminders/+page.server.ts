// src/routes/reminders/+page.server.ts
// PURPOSE: List all open reminders for the current user - with quick Complete and Delete actions.
// MULTI TENANT: All reads and writes are scoped by userId.
// SECURITY: Decrypt contact name on the server only.

import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

export const load: PageServerLoad = async ({ locals }) => {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // Fetch open reminders with minimal contact info for links and display
  const rows = await prisma.reminder.findMany({
    where: { userId: locals.user.id, completedAt: null },
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

  const now = new Date();

  // Decrypt and split into overdue vs upcoming - do not crash on decrypt failures
  const items = rows.map((r) => {
    let name = '(name unavailable)';
    let company: string | null = null;
    try { name = decrypt(r.contact.fullNameEnc, 'contact.full_name'); } catch {}
    try { company = r.contact.companyEnc ? decrypt(r.contact.companyEnc, 'contact.company') : null; } catch {}

    return {
      id: r.id,
      dueAt: r.dueAt,
      note: r.note || '',
      contactId: r.contactId,
      contactName: name,
      company
    };
  });

  const overdue = items.filter((x) => x.dueAt <= now);
  const upcoming = items.filter((x) => x.dueAt > now);

  return {
    overdue,
    upcoming,
    now
  };
};

export const actions: Actions = {
  // Mark a reminder complete
  complete: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing reminder id' });

    try {
      const res = await prisma.reminder.updateMany({
        where: { id, userId: locals.user.id, completedAt: null },
        data: { completedAt: new Date() }
      });
      if (!res.count) return fail(404, { error: 'Reminder not found' });
    } catch (e) {
      console.error('[reminders:complete] failed', { id, err: e });
      return fail(500, { error: 'Failed to complete reminder' });
    }

    throw redirect(303, '/reminders');
  },

  // Delete a reminder
  remove: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const id = String(form.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing reminder id' });

    try {
      const res = await prisma.reminder.deleteMany({
        where: { id, userId: locals.user.id }
      });
      if (!res.count) return fail(404, { error: 'Reminder not found' });
    } catch (e) {
      console.error('[reminders:remove] failed', { id, err: e });
      return fail(500, { error: 'Failed to delete reminder' });
    }

    throw redirect(303, '/reminders');
  }
};

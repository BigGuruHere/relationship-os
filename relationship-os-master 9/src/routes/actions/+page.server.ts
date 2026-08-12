// src/routes/actions/+page.server.ts
// PURPOSE: Load a daily action dashboard across cadence, reminders, and the new unified task layer.
// SECURITY: All queries are tenant scoped by locals.user.id. Decrypt only on the server.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { safeDecrypt } from '$lib/deals';
import { projectStatusLabel, safeDecryptTask, taskStatusLabel, taskTypeLabel, taskUrgencyLabel } from '$lib/tasks';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) throw redirect(303, '/auth/login');

  const reconnectCandidates = await prisma.contact.findMany({
    where: { userId: user.id, reconnectEveryDays: { not: null, gt: 0 } },
    select: { id: true, fullNameEnc: true, companyEnc: true, positionEnc: true, createdAt: true, lastContactedAt: true, reconnectEveryDays: true },
    take: 200
  });

  const now = Date.now();
  const dueReconnects = reconnectCandidates
    .filter((c) => {
      const cadence = c.reconnectEveryDays ?? 0;
      const baseline = (c.lastContactedAt ?? c.createdAt).getTime();
      const nextDueAt = baseline + cadence * 24 * 60 * 60 * 1000;
      return cadence > 0 && now >= nextDueAt;
    })
    .map((c) => {
      let name = '(name unavailable)';
      let company: string | null = null;
      let position: string | null = null;
      try { if (c.fullNameEnc) name = decrypt(c.fullNameEnc, 'contact.full_name'); } catch {}
      try { if (c.companyEnc) company = decrypt(c.companyEnc, 'contact.company'); } catch {}
      try { if (c.positionEnc) position = decrypt(c.positionEnc, 'contact.position'); } catch {}
      return { id: c.id, displayName: name, company, position, cadenceDays: c.reconnectEveryDays, lastContactedAt: c.lastContactedAt };
    });

  const reminderRows = await prisma.reminder.findMany({
    where: { userId: user.id, completedAt: null },
    select: { id: true, dueAt: true, note: true, contactId: true, contact: { select: { id: true, fullNameEnc: true, companyEnc: true, linkedUserId: true } } },
    orderBy: { dueAt: 'asc' },
    take: 100
  });

  const reminders = await Promise.all(reminderRows.map(async (r: any) => ({
    id: r.id,
    dueAt: r.dueAt,
    title: r.note || 'Reminder',
    note: r.note || '',
    contactId: r.contactId,
    contactName: await contactDisplayName(r.contact),
    company: (() => { try { return r.contact.companyEnc ? decrypt(r.contact.companyEnc, 'contact.company') : null; } catch { return null; } })()
  })));

  const taskRows = await prisma.task.findMany({
    where: { userId: user.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
    select: {
      id: true, titleEnc: true, notesEnc: true, status: true, urgency: true, taskType: true, dueAt: true,
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      deal: { select: { id: true, titleEnc: true } },
      dealContact: { select: { id: true, dealId: true, contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } } } },
      project: { select: { id: true, titleEnc: true, status: true } }
    },
    orderBy: [{ dueAt: 'asc' }, { urgency: 'desc' }, { updatedAt: 'desc' }],
    take: 150
  });

  const tasks = await Promise.all(taskRows.map(async (task: any) => ({
    id: task.id,
    title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
    notes: safeDecryptTask(task.notesEnc, 'task.notes', ''),
    status: task.status,
    statusLabel: taskStatusLabel(task.status),
    urgency: task.urgency,
    urgencyLabel: taskUrgencyLabel(task.urgency),
    taskTypeLabel: taskTypeLabel(task.taskType),
    dueAt: task.dueAt,
    contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
    deal: task.deal ? { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal') } : null,
    dealContact: task.dealContact ? { id: task.dealContact.id, dealId: task.dealContact.dealId, contactName: await contactDisplayName(task.dealContact.contact) } : null,
    project: task.project ? { id: task.project.id, title: safeDecryptTask(task.project.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(task.project.status) } : null
  })));

  const reconnectDue = dueReconnects.length;
  const remindersOpenCount = reminders.length;
  const tasksOpenCount = tasks.length;
  const actionsCount = reconnectDue + remindersOpenCount + tasksOpenCount;

  return { reconnectDue, remindersOpenCount, tasksOpenCount, actionsCount, dueReconnects, reminders, tasks };
};

// src/lib/server/taskRecurrence.ts
// PURPOSE: Keep recurring tasks simple and predictable: one outstanding occurrence at a time,
// anchored to the original schedule rather than drifting when a task is completed late.
// SECURITY: Every operation is scoped to the authenticated user's task id.

import { prisma } from '$lib/db';
import { randomUUID } from 'node:crypto';

export type TaskRecurrenceRule = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

const ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as const;

// IT: Add calendar months while preserving the intended day where possible. For dates such as
// January 31, February is clamped to its last day, then later months return to the anchor day.
function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function addRule(date: Date, rule: TaskRecurrenceRule, count = 1) {
  const result = new Date(date);
  if (rule === 'DAILY') result.setDate(result.getDate() + count);
  else if (rule === 'WEEKLY') result.setDate(result.getDate() + 7 * count);
  else if (rule === 'FORTNIGHTLY') result.setDate(result.getDate() + 14 * count);
  else result.setTime(addMonths(result, count).getTime());
  return result;
}

// IT: Find the first scheduled occurrence after the completed occurrence and then skip any dates
// that are already in the past. This prevents duplicate overdue occurrences while preserving the
// original cadence.
export function nextFutureOccurrence(anchor: Date, currentDueAt: Date, rule: TaskRecurrenceRule, now = new Date()) {
  let occurrenceIndex = 1;
  let occurrence = addRule(anchor, rule, occurrenceIndex);
  let guard = 0;

  // IT: Always calculate each occurrence from the original anchor. This matters for monthly
  // schedules such as January 31 -> February 28 -> March 31 rather than drifting to March 28.
  while (occurrence <= currentDueAt && guard < 10000) {
    guard += 1;
    occurrenceIndex += 1;
    occurrence = addRule(anchor, rule, occurrenceIndex);
  }

  while (occurrence <= now && guard < 20000) {
    guard += 1;
    occurrenceIndex += 1;
    occurrence = addRule(anchor, rule, occurrenceIndex);
  }

  return occurrence;
}

function recurrenceRule(value: unknown): TaskRecurrenceRule | null {
  const raw = String(value || '').trim().toUpperCase();
  return raw === 'DAILY' || raw === 'WEEKLY' || raw === 'FORTNIGHTLY' || raw === 'MONTHLY' ? raw : null;
}

// IT: Complete one task and, when appropriate, create exactly one next occurrence. The update
// predicate prevents a repeated DONE submission from generating another occurrence.
export async function completeTaskAndAdvanceRecurrence(userId: string, taskId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return { found: false, advanced: false };

    const completedAt = new Date();
    const result = await tx.task.updateMany({
      where: { id: taskId, userId, status: { not: 'DONE' } },
      data: { status: 'DONE', completedAt, cancelledAt: null }
    });

    if (!result.count && task.status !== 'DONE') return { found: true, advanced: false };

    const rule = recurrenceRule(task.recurrenceRule);
    if (!rule || !task.dueAt || !task.recurrenceSeriesId || !task.recurrenceAnchorAt) {
      return { found: true, advanced: false };
    }

    // IT: One open occurrence is the invariant. If one already exists, do not create another.
    const existing = await tx.task.findFirst({
      where: {
        userId,
        recurrenceSeriesId: task.recurrenceSeriesId,
        status: { in: [...ACTIVE_STATUSES] }
      },
      select: { id: true }
    });
    if (existing) return { found: true, advanced: false };

    const nextDueAt = nextFutureOccurrence(task.recurrenceAnchorAt, task.dueAt, rule, completedAt);

    const nextTask = await tx.task.create({
      data: {
        userId,
        titleEnc: task.titleEnc,
        notesEnc: task.notesEnc,
        summaryEnc: task.summaryEnc,
        status: 'OPEN',
        urgency: task.urgency,
        importance: task.importance,
        focus: task.focus,
        taskType: task.taskType,
        dueAt: nextDueAt,
        snoozedUntil: null,
        completedAt: null,
        cancelledAt: null,
        assignedToTextEnc: task.assignedToTextEnc,
        assignedToContactId: task.assignedToContactId,
        waitingOnContactId: task.waitingOnContactId,
        contactId: task.contactId,
        dealId: task.dealId,
        dealContactId: task.dealContactId,
        projectId: task.projectId,
        workstreamId: task.workstreamId,
        marketLeadId: task.marketLeadId,
        wantId: task.wantId,
        offerId: task.offerId,
        companyId: task.companyId,
        companyContactId: task.companyContactId,
        dealCompanyId: task.dealCompanyId,
        sourceType: task.sourceType,
        sourceId: task.sourceId,
        recurrenceRule: task.recurrenceRule,
        recurrenceSeriesId: task.recurrenceSeriesId,
        recurrenceAnchorAt: task.recurrenceAnchorAt
      },
      select: { id: true, dueAt: true }
    });

    return { found: true, advanced: true, nextTaskId: nextTask.id, nextDueAt: nextTask.dueAt };
  });
}

export function recurrenceLabel(rule: string | null | undefined) {
  if (rule === 'DAILY') return 'Repeats daily';
  if (rule === 'WEEKLY') return 'Repeats weekly';
  if (rule === 'FORTNIGHTLY') return 'Repeats fortnightly';
  if (rule === 'MONTHLY') return 'Repeats monthly';
  return '';
}

export function parseRecurrenceRule(value: FormDataEntryValue | null) {
  return recurrenceRule(value);
}

export function recurrenceFields(rule: TaskRecurrenceRule | null, dueAt: Date | null, existingSeriesId?: string | null, existingAnchorAt?: Date | null) {
  if (!rule) return { recurrenceRule: null, recurrenceSeriesId: null, recurrenceAnchorAt: null };
  if (!dueAt) throw new Error('A due date is required for a recurring task.');
  return {
    recurrenceRule: rule,
    recurrenceSeriesId: existingSeriesId || randomUUID(),
    recurrenceAnchorAt: existingAnchorAt || dueAt
  };
}

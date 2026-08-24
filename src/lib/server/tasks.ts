// src/lib/server/tasks.ts
// PURPOSE: Shared create-task logic used by every page that creates a Task, reproducing the
//   canonical src/routes/tasks/+page.server.ts "create" action exactly (workstream-sets-parent-
//   project rule + mismatch guard, market-lead inheritance, deal-contact/deal-company inheritance,
//   and full ownership verification on every linked id).
// SECURITY: Every linked id is re-verified against locals.user.id via ownedIdExists before the task
//   is written. Caller-supplied `context` values hard-override the form for that field (and are
//   folded into the deal-contact/deal-company lookup WHERE clauses) so a locked field cannot be
//   escaped by a crafted form submission - see createTaskFromForm for details.

import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import {
  normaliseTaskFocus,
  normaliseTaskImportance,
  normaliseTaskStatus,
  normaliseTaskType,
  normaliseTaskUrgency,
  parseDateTime
} from '$lib/tasks';

export type TaskLinkKind = 'contact' | 'deal' | 'project' | 'workstream' | 'company' | 'marketLead' | 'want' | 'offer';

// IT: single canonical ownership check, shared by every create-task caller - see $lib/tasks.ts
// callers for the two divergent copies this replaces.
export async function ownedIdExists(userId: string, kind: TaskLinkKind, id: string | null): Promise<boolean> {
  if (!id) return true;
  if (kind === 'contact') return !!(await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'workstream') return !!(await prisma.projectWorkstream.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'deal') return !!(await prisma.deal.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'company') return !!(await prisma.company.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'marketLead') return !!(await prisma.marketLead.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'want') return !!(await prisma.want.findFirst({ where: { id, userId }, select: { id: true } }));
  if (kind === 'offer') return !!(await prisma.offer.findFirst({ where: { id, userId }, select: { id: true } }));
  return !!(await prisma.project.findFirst({ where: { id, userId }, select: { id: true } }));
}

export type CreateTaskContext = {
  contactId?: string | null;
  dealId?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  workstreamId?: string | null;
  // IT: locks the task to a specific market lead (leads/[id]) - overridden the same way as the
  // fields above, before the marketLeadId inheritance block below runs off of it.
  marketLeadId?: string | null;
  wantId?: string | null;
  offerId?: string | null;
  // IT: locks the task to a specific deal-person thread (deals/[id]/relationships/[linkId]) - folded
  // in before the dealContactId inheritance block below, so a crafted form value can't escape it.
  dealContactId?: string | null;
  // IT: not a canonical form field - Task.companyContactId has no picker anywhere. Context-only,
  // written as-is. The caller (companies/[id]/contacts/[linkId]) has already verified the
  // relationship belongs to this user before calling, so no re-check is done here.
  companyContactId?: string | null;
  // IT: opt-in ProjectDeal upsert side effect. Canonical /tasks never does this (default off).
  // Pages that already relied on it (deals/[id], projects/[id], the workstream sub-page) opt in.
  linkProjectDeal?: boolean;
};

export type CreateTaskResult = { ok: true; taskId: string } | { ok: false; status: number; error: string };

const LOCKABLE_FIELDS = ['contactId', 'dealId', 'companyId', 'projectId', 'workstreamId'] as const;

export async function createTaskFromForm(
  userId: string,
  form: FormData,
  context: CreateTaskContext = {}
): Promise<CreateTaskResult> {
  const title = String(form.get('title') || '').trim();
  if (!title) return { ok: false, status: 400, error: 'Task title is required.' };

  let contactId = String(form.get('contactId') || '').trim() || null;
  let dealId = String(form.get('dealId') || '').trim() || null;
  let dealContactId = String(form.get('dealContactId') || '').trim() || null;
  let companyId = String(form.get('companyId') || '').trim() || null;
  let dealCompanyId = String(form.get('dealCompanyId') || '').trim() || null;
  let marketLeadId = String(form.get('marketLeadId') || '').trim() || null;
  let wantId = String(form.get('wantId') || '').trim() || null;
  let offerId = String(form.get('offerId') || '').trim() || null;
  let projectId = String(form.get('projectId') || '').trim() || null;
  let workstreamId = String(form.get('workstreamId') || '').trim() || null;
  const assignedToContactId = String(form.get('assignedToContactId') || '').trim() || null;
  const waitingOnContactId = String(form.get('waitingOnContactId') || '').trim() || null;

  // IT: hard-override for any field the caller has locked via route context - a submitted form
  // value for a locked field is discarded here, before any inheritance rule can act on it.
  if ('contactId' in context) contactId = context.contactId ?? null;
  if ('dealId' in context) dealId = context.dealId ?? null;
  if ('companyId' in context) companyId = context.companyId ?? null;
  if ('projectId' in context) projectId = context.projectId ?? null;
  if ('workstreamId' in context) workstreamId = context.workstreamId ?? null;
  if ('marketLeadId' in context) marketLeadId = context.marketLeadId ?? null;
  if ('wantId' in context) wantId = context.wantId ?? null;
  if ('offerId' in context) offerId = context.offerId ?? null;
  if ('dealContactId' in context) dealContactId = context.dealContactId ?? null;

  if (dealContactId) {
    // IT: fold locked contactId/dealId into the lookup WHERE clause - otherwise a dealContactId
    // belonging to a different contact/deal than the lock would silently overwrite the lock below.
    const link = await prisma.dealContact.findFirst({
      where: {
        id: dealContactId,
        userId,
        ...('contactId' in context ? { contactId: context.contactId ?? undefined } : {}),
        ...('dealId' in context ? { dealId: context.dealId ?? undefined } : {})
      },
      select: { id: true, dealId: true, contactId: true }
    });
    if (!link) return { ok: false, status: 404, error: 'Deal relationship not found.' };
    dealId = link.dealId;
    contactId = link.contactId;
  }

  if (dealCompanyId) {
    const link = await prisma.dealCompany.findFirst({
      where: {
        id: dealCompanyId,
        userId,
        ...('companyId' in context ? { companyId: context.companyId ?? undefined } : {}),
        ...('dealId' in context ? { dealId: context.dealId ?? undefined } : {})
      },
      select: { id: true, dealId: true, companyId: true }
    });
    if (!link) return { ok: false, status: 404, error: 'Deal-company link not found.' };
    dealId = link.dealId;
    companyId = link.companyId;
  }

  if (marketLeadId) {
    // IT: lookup stays unscoped by project/etc (matches canonical) - scoping at the query level
    // would wrongly exclude legitimately unlinked leads (projectId: null). The mismatch is instead
    // checked below, after fetch, only against fields the caller has actually locked.
    const lead = await prisma.marketLead.findFirst({
      where: { id: marketLeadId, userId },
      select: { id: true, projectId: true, workstreamId: true, contactId: true, companyId: true, dealId: true, wantId: true, offerId: true }
    });
    if (!lead) return { ok: false, status: 404, error: 'Lead not found.' };

    for (const field of LOCKABLE_FIELDS) {
      if (!(field in context)) continue;
      const lockedValue = (context as Record<string, string | null | undefined>)[field];
      const leadValue = (lead as Record<string, string | null>)[field];
      if (lockedValue && leadValue && leadValue !== lockedValue) {
        return { ok: false, status: 400, error: `Selected lead belongs to a different ${field.replace('Id', '')}.` };
      }
    }

    projectId = projectId || lead.projectId || null;
    workstreamId = workstreamId || lead.workstreamId || null;
    contactId = contactId || lead.contactId || null;
    companyId = companyId || lead.companyId || null;
    dealId = dealId || lead.dealId || null;
    wantId = wantId || (lead as any).wantId || null;
    offerId = offerId || (lead as any).offerId || null;
  }


  if (wantId) {
    const want = await prisma.want.findFirst({
      where: { id: wantId, userId },
      select: { id: true, projectId: true, workstreamId: true, contactId: true, companyId: true, dealId: true }
    });
    if (!want) return { ok: false, status: 404, error: 'Want not found.' };

    for (const field of LOCKABLE_FIELDS) {
      if (!(field in context)) continue;
      const lockedValue = (context as Record<string, string | null | undefined>)[field];
      const wantValue = (want as Record<string, string | null>)[field];
      if (lockedValue && wantValue && wantValue !== lockedValue) {
        return { ok: false, status: 400, error: `Selected want belongs to a different ${field.replace('Id', '')}.` };
      }
    }

    projectId = projectId || want.projectId || null;
    workstreamId = workstreamId || want.workstreamId || null;
    contactId = contactId || want.contactId || null;
    companyId = companyId || want.companyId || null;
    dealId = dealId || want.dealId || null;
  }



  if (offerId) {
    const offer = await prisma.offer.findFirst({
      where: { id: offerId, userId },
      select: { id: true, projectId: true, workstreamId: true, contactId: true, companyId: true, dealId: true }
    });
    if (!offer) return { ok: false, status: 404, error: 'Offer not found.' };

    for (const field of LOCKABLE_FIELDS) {
      if (!(field in context)) continue;
      const lockedValue = (context as Record<string, string | null | undefined>)[field];
      const offerValue = (offer as Record<string, string | null>)[field];
      if (lockedValue && offerValue && offerValue !== lockedValue) {
        return { ok: false, status: 400, error: `Selected offer belongs to a different ${field.replace('Id', '')}.` };
      }
    }

    projectId = projectId || offer.projectId || null;
    workstreamId = workstreamId || offer.workstreamId || null;
    contactId = contactId || offer.contactId || null;
    companyId = companyId || offer.companyId || null;
    dealId = dealId || offer.dealId || null;
  }

  if (workstreamId) {
    const ws = await prisma.projectWorkstream.findFirst({ where: { id: workstreamId, userId }, select: { id: true, projectId: true } });
    if (!ws) return { ok: false, status: 404, error: 'Workstream not found.' };
    projectId = projectId || ws.projectId;
    if (projectId !== ws.projectId) return { ok: false, status: 400, error: 'Selected workstream belongs to a different project.' };
  }

  const [contactOk, dealOk, projectOk, workstreamOk, companyOk, leadOk, wantOk, offerOk, assignedOk, waitingOk] = await Promise.all([
    ownedIdExists(userId, 'contact', contactId),
    ownedIdExists(userId, 'deal', dealId),
    ownedIdExists(userId, 'project', projectId),
    ownedIdExists(userId, 'workstream', workstreamId),
    ownedIdExists(userId, 'company', companyId),
    ownedIdExists(userId, 'marketLead', marketLeadId),
    ownedIdExists(userId, 'want', wantId),
    ownedIdExists(userId, 'offer', offerId),
    ownedIdExists(userId, 'contact', assignedToContactId),
    ownedIdExists(userId, 'contact', waitingOnContactId)
  ]);
  if (!contactOk || !dealOk || !projectOk || !workstreamOk || !companyOk || !leadOk || !wantOk || !offerOk || !assignedOk || !waitingOk) {
    return { ok: false, status: 404, error: 'One of the selected links was not found.' };
  }

  const notes = String(form.get('notes') || '').trim();
  const summary = String(form.get('summary') || '').trim();
  const assignedToText = String(form.get('assignedToText') || '').trim();

  try {
    const task = await prisma.task.create({
      data: {
        userId,
        titleEnc: encrypt(title, 'task.title'),
        notesEnc: notes ? encrypt(notes, 'task.notes') : null,
        summaryEnc: summary ? encrypt(summary, 'task.summary') : null,
        status: normaliseTaskStatus(form.get('status')) as any,
        urgency: normaliseTaskUrgency(form.get('urgency')) as any,
        importance: normaliseTaskImportance(form.get('importance')) as any,
        focus: normaliseTaskFocus(form.get('focus')) as any,
        taskType: normaliseTaskType(form.get('taskType')) as any,
        dueAt: parseDateTime(form.get('dueAt')),
        snoozedUntil: parseDateTime(form.get('snoozedUntil')),
        assignedToTextEnc: assignedToText ? encrypt(assignedToText, 'task.assigned_to_text') : null,
        assignedToContactId,
        waitingOnContactId,
        contactId,
        dealId,
        dealContactId,
        companyId,
        dealCompanyId,
        marketLeadId,
        wantId,
        offerId,
        projectId,
        workstreamId,
        companyContactId: context.companyContactId ?? null
      },
      select: { id: true }
    });

    if (context.linkProjectDeal && dealId && projectId) {
      await prisma.projectDeal
        .upsert({
          where: { projectId_dealId: { projectId, dealId } },
          update: workstreamId ? { workstreamId } : {},
          create: { userId, projectId, dealId, workstreamId }
        })
        .catch(() => null);
    }

    return { ok: true, taskId: task.id };
  } catch (err) {
    console.error('[tasks:createTaskFromForm] failed', err);
    return { ok: false, status: 500, error: 'Could not create task.' };
  }
}

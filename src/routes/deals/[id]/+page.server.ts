// src/routes/deals/[id]/+page.server.ts
// PURPOSE: Show a deal, update deal state, and manage the contacts involved.
// SECURITY: Every read and write is scoped by userId.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import { createExchangeItemFromForm, deleteExchangeItem, loadExchangeItems } from '$lib/server/exchange';
import { loadAgentArtifacts } from '$lib/server/agents/artifacts';
import { runOpportunityScoringAgent } from '$lib/server/agents/agents/opportunityScoringAgent';
import { createTaskFromForm } from '$lib/server/tasks';
import { marketLeadStatusLabel } from '$lib/marketLeads';
import { companyDisplay, companyKindLabel, safeDecryptCompany } from '$lib/companies';
import {
  DEAL_RELATIONSHIP_TYPES,
  DEAL_STATUSES,
  centsToInputValue,
  dateToInputValue,
  dealRelationshipLabel,
  dealStatusLabel,
  formatDealValue,
  isClosedDealStatus,
  normaliseDealRelationshipType,
  normaliseDealStatus,
  parseMoneyToCents,
  parseOptionalDate,
  parseProbability,
  safeDecrypt,
  weightedValueCents
} from '$lib/deals';
import {
  DEAL_CONFIDENTIALITY_STAGES,
  DEAL_CONTACT_INTERESTS,
  DEAL_CONTACT_STAGES,
  PROJECT_STATUSES,
  TASK_FOCUS_OPTIONS,
  TASK_IMPORTANCES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_URGENCIES,
  dateTimeToInputValue,
  dealConfidentialityLabel,
  dealContactInterestLabel,
  dealContactStageLabel,
  normaliseDealConfidentiality,
  normaliseDealContactInterest,
  normaliseDealContactStage,
  normaliseTaskStatus,
  parseDateTime,
  projectStatusLabel,
  safeDecryptTask,
  taskFocusLabel,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

async function ensureOwnedDeal(userId: string, dealId: string) {
  return prisma.deal.findFirst({
    where: { id: dealId, userId },
    select: { id: true, status: true }
  });
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const row = await prisma.deal.findFirst({
    where: { id: params.id, userId: locals.user.id },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      descriptionSummaryEnc: true,
      valueCents: true,
      currency: true,
      status: true,
      probability: true,
      expectedCloseDate: true,
      closedAt: true,
      lostReasonEnc: true,
      createdAt: true,
      updatedAt: true,
      contacts: {
        select: {
          id: true,
          contactId: true,
          relationshipType: true,
          label: true,
          notesEnc: true,
          isPrimary: true,
          stage: true,
          interestLevel: true,
          confidentialityStage: true,
          nextActionEnc: true,
          nextFollowUpAt: true,
          lastContactedAt: true,
          buyingCriteriaEnc: true,
          objectionsEnc: true,
          fundingCapacityEnc: true,
          referralPathEnc: true,
          _count: { select: { notes: true, tasks: true } },
          createdAt: true,
          updatedAt: true,
          contact: {
            select: {
              id: true,
              fullNameEnc: true,
              emailEnc: true,
              phoneEnc: true,
              companyEnc: true,
              linkedUserId: true
            }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      },
      companies: {
        select: {
          id: true,
          companyId: true,
          relationshipType: true,
          label: true,
          notesEnc: true,
          isPrimary: true,
          stage: true,
          interestLevel: true,
          confidentialityStage: true,
          nextActionEnc: true,
          nextFollowUpAt: true,
          lastContactedAt: true,
          acquisitionRationaleEnc: true,
          objectionsEnc: true,
          fundingCapacityEnc: true,
          referralPathEnc: true,
          _count: { select: { tasks: true } },
          createdAt: true,
          updatedAt: true,
          company: {
            select: { id: true, nameEnc: true, websiteEnc: true, industryEnc: true, locationEnc: true, kind: true, status: true }
          }
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      }
    }
  });

  if (!row) throw redirect(303, '/deals');

  const people = await Promise.all(
    row.contacts.map(async (link: any) => ({
      id: link.id,
      contactId: link.contactId,
      name: await contactDisplayName(link.contact),
      company: safeDecrypt(link.contact.companyEnc, 'contact.company', ''),
      email: safeDecrypt(link.contact.emailEnc, 'contact.email', ''),
      phone: safeDecrypt(link.contact.phoneEnc, 'contact.phone', ''),
      relationshipType: link.relationshipType,
      relationshipLabel: dealRelationshipLabel(link.relationshipType, link.label),
      label: link.label || '',
      notes: safeDecrypt(link.notesEnc, 'deal_contact.notes', ''),
      isPrimary: link.isPrimary,
      stage: link.stage,
      stageLabel: dealContactStageLabel(link.stage),
      interestLevel: link.interestLevel,
      interestLabel: dealContactInterestLabel(link.interestLevel),
      confidentialityStage: link.confidentialityStage,
      confidentialityLabel: dealConfidentialityLabel(link.confidentialityStage),
      nextAction: safeDecryptTask(link.nextActionEnc, 'deal_contact.next_action', ''),
      nextFollowUpAt: link.nextFollowUpAt,
      nextFollowUpAtInput: dateTimeToInputValue(link.nextFollowUpAt),
      lastContactedAt: link.lastContactedAt,
      buyingCriteria: safeDecryptTask(link.buyingCriteriaEnc, 'deal_contact.buying_criteria', ''),
      objections: safeDecryptTask(link.objectionsEnc, 'deal_contact.objections', ''),
      fundingCapacity: safeDecryptTask(link.fundingCapacityEnc, 'deal_contact.funding_capacity', ''),
      referralPath: safeDecryptTask(link.referralPathEnc, 'deal_contact.referral_path', ''),
      noteCount: link._count?.notes || 0,
      taskCount: link._count?.tasks || 0,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt
    }))
  );


  const companies = row.companies.map((link: any) => ({
    id: link.id,
    companyId: link.companyId,
    name: safeDecryptCompany(link.company.nameEnc, 'company.name', 'Untitled company'),
    website: safeDecryptCompany(link.company.websiteEnc, 'company.website', ''),
    industry: safeDecryptCompany(link.company.industryEnc, 'company.industry', ''),
    location: safeDecryptCompany(link.company.locationEnc, 'company.location', ''),
    kind: link.company.kind,
    kindLabel: companyKindLabel(link.company.kind),
    relationshipType: link.relationshipType,
    relationshipLabel: dealRelationshipLabel(link.relationshipType, link.label),
    label: link.label || '',
    notes: safeDecryptCompany(link.notesEnc, 'deal_company.notes', ''),
    isPrimary: link.isPrimary,
    stage: link.stage,
    stageLabel: dealContactStageLabel(link.stage),
    interestLevel: link.interestLevel,
    interestLabel: dealContactInterestLabel(link.interestLevel),
    confidentialityStage: link.confidentialityStage,
    confidentialityLabel: dealConfidentialityLabel(link.confidentialityStage),
    nextAction: safeDecryptTask(link.nextActionEnc, 'deal_company.next_action', ''),
    nextFollowUpAt: link.nextFollowUpAt,
    acquisitionRationale: safeDecryptCompany(link.acquisitionRationaleEnc, 'deal_company.acquisition_rationale', ''),
    objections: safeDecryptCompany(link.objectionsEnc, 'deal_company.objections', ''),
    fundingCapacity: safeDecryptCompany(link.fundingCapacityEnc, 'deal_company.funding_capacity', ''),
    referralPath: safeDecryptCompany(link.referralPathEnc, 'deal_company.referral_path', ''),
    taskCount: link._count?.tasks || 0,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt
  }));

  const attachedContactIds = new Set(row.contacts.map((link: any) => link.contactId));
  const availableContactsRaw = await prisma.contact.findMany({
    where: { userId: locals.user.id, id: { notIn: [...attachedContactIds] } },
    select: { id: true, fullNameEnc: true, linkedUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 300
  });

  const attachedCompanyIds = new Set(row.companies.map((link: any) => link.companyId));
  const availableCompaniesRaw = await prisma.company.findMany({
    where: { userId: locals.user.id, id: { notIn: [...attachedCompanyIds] } },
    select: { id: true, nameEnc: true, kind: true },
    orderBy: { updatedAt: 'desc' },
    take: 300
  });

  const notesRaw = await prisma.dealNote.findMany({
    where: { userId: locals.user.id, dealId: row.id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      summaryEnc: true,
      contact: {
        select: { id: true, fullNameEnc: true, linkedUserId: true }
      }
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 30
  });

  const notes = await Promise.all(
    notesRaw.map(async (note: any) => {
      const rawText = safeDecrypt(note.rawTextEnc, 'deal_note.raw_text', '');
      const summary = safeDecrypt(note.summaryEnc, 'deal_note.summary', '');
      const previewSource = summary || rawText;
      const preview = previewSource.length > 320 ? previewSource.slice(0, 317) + '...' : previewSource;
      return {
        id: note.id,
        channel: note.channel,
        occurredAt: note.occurredAt,
        preview,
        rawText,
        summary,
        contactId: note.contact?.id || null,
        contactName: note.contact ? await contactDisplayName(note.contact) : ''
      };
    })
  );


  const threadNotesRaw = await prisma.dealContactNote.findMany({
    where: { userId: locals.user.id, dealId: row.id },
    select: {
      id: true,
      channel: true,
      occurredAt: true,
      rawTextEnc: true,
      summaryEnc: true,
      dealContact: {
        select: {
          id: true,
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
        }
      }
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 20
  });

  const threadNotes = await Promise.all(threadNotesRaw.map(async (note: any) => {
    const rawText = safeDecryptTask(note.rawTextEnc, 'deal_contact_note.raw_text', '');
    const summary = safeDecryptTask(note.summaryEnc, 'deal_contact_note.summary', '');
    const previewSource = summary || rawText;
    return {
      id: note.id,
      channel: note.channel,
      occurredAt: note.occurredAt,
      preview: previewSource.length > 260 ? `${previewSource.slice(0, 257)}...` : previewSource,
      rawText,
      summary,
      dealContactId: note.dealContact.id,
      contactId: note.dealContact.contact.id,
      contactName: await contactDisplayName(note.dealContact.contact)
    };
  }));

  const tasksRaw = await prisma.task.findMany({
    where: { userId: locals.user.id, dealId: row.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
    select: {
      id: true, titleEnc: true, notesEnc: true, summaryEnc: true, status: true, urgency: true, importance: true, focus: true, taskType: true, dueAt: true,
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      company: { select: { id: true, nameEnc: true } },
      dealContact: { select: { id: true, contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } } } },
      dealCompany: { select: { id: true, company: { select: { id: true, nameEnc: true } } } },
      project: { select: { id: true, titleEnc: true, status: true } }
    },
    orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
    take: 30
  });

  const tasks = await Promise.all(tasksRaw.map(async (task: any) => ({
    id: task.id,
    title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
    notes: safeDecryptTask(task.notesEnc, 'task.notes', ''),
    summary: safeDecryptTask(task.summaryEnc, 'task.summary', ''),
    status: task.status,
    statusLabel: taskStatusLabel(task.status),
    urgency: task.urgency,
    urgencyLabel: taskUrgencyLabel(task.urgency),
    importanceLabel: taskImportanceLabel(task.importance),
    focus: task.focus,
    focusLabel: taskFocusLabel(task.focus),
    taskTypeLabel: taskTypeLabel(task.taskType),
    dueAt: task.dueAt,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null,
    contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
    company: task.company ? { id: task.company.id, name: safeDecryptCompany(task.company.nameEnc, 'company.name', 'Untitled company') } : null,
    dealContact: task.dealContact ? { id: task.dealContact.id, dealId: row.id, contactName: await contactDisplayName(task.dealContact.contact) } : null,
    dealCompany: task.dealCompany ? { id: task.dealCompany.id, companyId: task.dealCompany.company.id, companyName: safeDecryptCompany(task.dealCompany.company.nameEnc, 'company.name', 'Untitled company') } : null,
    project: task.project ? { id: task.project.id, title: safeDecryptTask(task.project.titleEnc, 'project.title', 'Untitled project'), statusLabel: projectStatusLabel(task.project.status) } : null
  })));

  const projectsRaw = await prisma.project.findMany({
    where: { userId: locals.user.id, status: { not: 'ARCHIVED' as any } },
    select: { id: true, titleEnc: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });
  const projectOptions = projectsRaw.map((project: any) => ({
    id: project.id,
    title: safeDecryptTask(project.titleEnc, 'project.title', 'Untitled project'),
    statusLabel: projectStatusLabel(project.status)
  }));

  const workstreamsRaw = await prisma.projectWorkstream.findMany({
    where: { userId: locals.user.id, status: { not: 'ARCHIVED' as any }, project: { status: { not: 'ARCHIVED' as any } } },
    select: { id: true, nameEnc: true, projectId: true, status: true, project: { select: { id: true, titleEnc: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 300
  });
  const workstreamOptions = workstreamsRaw.map((ws: any) => ({
    id: ws.id,
    projectId: ws.projectId,
    name: safeDecryptTask(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'),
    projectTitle: safeDecryptTask(ws.project?.titleEnc, 'project.title', 'Untitled project'),
    status: ws.status
  }));

  const linkedProjectDealsRaw = await prisma.projectDeal.findMany({
    where: { userId: locals.user.id, dealId: row.id },
    select: {
      id: true,
      labelEnc: true,
      notesEnc: true,
      createdAt: true,
      workstream: { select: { id: true, nameEnc: true, projectId: true, status: true } },
      project: { select: { id: true, titleEnc: true, status: true, updatedAt: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  const linkedProjects = linkedProjectDealsRaw.map((link: any) => ({
    id: link.id,
    projectId: link.project.id,
    title: safeDecryptTask(link.project.titleEnc, 'project.title', 'Untitled project'),
    status: link.project.status,
    statusLabel: projectStatusLabel(link.project.status),
    label: safeDecryptTask(link.labelEnc, 'project_deal.label', ''),
    notes: safeDecryptTask(link.notesEnc, 'project_deal.notes', ''),
    workstream: link.workstream ? { id: link.workstream.id, name: safeDecryptTask(link.workstream.nameEnc, 'project_workstream.name', 'Untitled workstream'), projectId: link.workstream.projectId, status: link.workstream.status } : null,
    createdAt: link.createdAt,
    updatedAt: link.project.updatedAt
  }));
  const linkedProjectIds = new Set(linkedProjects.map((project: any) => project.projectId));

  const exchangeItems = await loadExchangeItems({ userId: locals.user.id, links: { dealId: row.id } });
  const agentArtifacts = await loadAgentArtifacts({ userId: locals.user.id, entityType: 'deal', entityId: row.id });

  const weighted = weightedValueCents(row.valueCents, row.probability);

  // IT: full canonical picker option lists for TasksPanel - see src/lib/TasksPanel.svelte. These
  // are global/unscoped (unlike `contactOptions`/`companyOptions` above, which exclude rows
  // already attached to this deal - wrong shape for a generic task-attach picker).
  const allContactsForTasksRaw = await prisma.contact.findMany({
    where: { userId: locals.user.id },
    select: { id: true, fullNameEnc: true, linkedUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 300
  });
  const taskContactOptions = await contactOptionsForRows(allContactsForTasksRaw);

  const allCompaniesForTasksRaw = await prisma.company.findMany({
    where: { userId: locals.user.id, status: { not: 'ARCHIVED' as any } },
    select: { id: true, nameEnc: true, kind: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 300
  });
  const taskCompanyOptions = allCompaniesForTasksRaw.map((c: any) => ({ id: c.id, name: companyDisplay(c) }));

  // IT: this deal's own threads - already loaded above as `people`/`companies`.
  const dealContactOptions = people.map((p: any) => ({ id: p.id, dealId: row.id, title: `${p.name}${p.label ? ` (${p.label})` : ''}` }));
  const dealCompanyOptions = companies.map((c: any) => ({ id: c.id, dealId: row.id, title: `${c.name}${c.label ? ` (${c.label})` : ''}` }));

  const marketLeadsForTasksRaw = await prisma.marketLead.findMany({
    where: { userId: locals.user.id, dealId: row.id, status: { not: 'ARCHIVED' as any } },
    select: { id: true, titleEnc: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 100
  });
  const taskMarketLeadOptions = marketLeadsForTasksRaw.map((lead: any) => ({ id: lead.id, title: safeDecryptTask(lead.titleEnc, 'market_lead.title', 'Untitled lead'), statusLabel: marketLeadStatusLabel(lead.status) }));

  return {
    deal: {
      id: row.id,
      title: safeDecrypt(row.titleEnc, 'deal.title', 'Untitled deal'),
      description: safeDecrypt(row.descriptionEnc, 'deal.description', ''),
      descriptionSummary: safeDecrypt(row.descriptionSummaryEnc, 'deal.description_summary', ''),
      valueCents: row.valueCents,
      valueInput: centsToInputValue(row.valueCents),
      valueLabel: formatDealValue(row.valueCents, row.currency),
      weightedValueLabel: weighted === null ? 'No weighted value' : formatDealValue(weighted, row.currency),
      currency: row.currency,
      status: row.status,
      statusLabel: dealStatusLabel(row.status),
      probability: row.probability,
      expectedCloseDate: row.expectedCloseDate,
      expectedCloseDateInput: dateToInputValue(row.expectedCloseDate),
      closedAt: row.closedAt,
      lostReason: safeDecrypt(row.lostReasonEnc, 'deal.lost_reason', ''),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    },
    people,
    companies,
    notes,
    threadNotes,
    tasks,
    exchangeItems,
    agentArtifacts,
    linkedProjects,
    projectOptions,
    workstreamOptions,
    projectOptionsForLinking: projectOptions.filter((project: any) => !linkedProjectIds.has(project.id)),
    contactOptions: await contactOptionsForRows(availableContactsRaw),
    companyOptions: availableCompaniesRaw.map((company: any) => ({
      id: company.id,
      name: safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company'),
      kindLabel: companyKindLabel(company.kind)
    })),
    taskContactOptions,
    taskCompanyOptions,
    dealContactOptions,
    dealCompanyOptions,
    taskMarketLeadOptions,
    statusOptions: DEAL_STATUSES,
    relationshipOptions: DEAL_RELATIONSHIP_TYPES,
    dealContactStageOptions: DEAL_CONTACT_STAGES,
    dealContactInterestOptions: DEAL_CONTACT_INTERESTS,
    dealConfidentialityOptions: DEAL_CONFIDENTIALITY_STAGES,
    taskStatusOptions: TASK_STATUSES,
    taskUrgencyOptions: TASK_URGENCIES,
    taskImportanceOptions: TASK_IMPORTANCES,
    taskTypeOptions: TASK_TYPES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    projectStatusOptions: PROJECT_STATUSES
  };
};

export const actions: Actions = {
  scoreDeal: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const deal = await ensureOwnedDeal(locals.user.id, params.id);
    if (!deal) return fail(404, { error: 'Deal not found.' });
    const run = await runOpportunityScoringAgent({
      userId: locals.user.id,
      entityType: 'deal',
      entityId: params.id,
      sector: 'Business broking deal',
      scoringGoal: 'Prioritise this deal and recommend the next human action.'
    });
    throw redirect(303, `/agents/runs/${run.id}`);
  },

  updateState: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const owned = await ensureOwnedDeal(locals.user.id, params.id);
    if (!owned) return fail(404, { error: 'Deal not found.' });

    const form = await request.formData();
    const status = normaliseDealStatus(form.get('status'));
    const probability = parseProbability(form.get('probability'));
    const valueCents = parseMoneyToCents(form.get('value'));
    const currency = String(form.get('currency') || 'AUD').trim().toUpperCase().slice(0, 3) || 'AUD';
    const expectedCloseDate = parseOptionalDate(form.get('expectedCloseDate'));
    const lostReason = String(form.get('lostReason') || '').trim();

    try {
      await prisma.deal.updateMany({
        where: { id: params.id, userId: locals.user.id },
        data: {
          status: status as any,
          probability,
          valueCents,
          currency,
          expectedCloseDate,
          closedAt: isClosedDealStatus(status) ? new Date() : null,
          lostReasonEnc: status === 'LOST' && lostReason ? encrypt(lostReason, 'deal.lost_reason') : null
        }
      });
    } catch (err) {
      console.error('[deals:updateState] failed', err);
      return fail(500, { error: 'Could not update deal state.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },

  linkProject: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const projectId = String(form.get('projectId') || '').trim();
    const workstreamId = String(form.get('workstreamId') || '').trim() || null;
    const label = String(form.get('label') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    if (!projectId) return fail(400, { error: 'Choose a project to link.' });

    const [deal, project] = await Promise.all([
      ensureOwnedDeal(userId, params.id),
      prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
    ]);
    if (!deal || !project) return fail(404, { error: 'Deal or project not found.' });
    if (workstreamId) {
      const ws = await prisma.projectWorkstream.findFirst({ where: { id: workstreamId, userId, projectId }, select: { id: true } });
      if (!ws) return fail(404, { error: 'Selected workstream was not found for this project.' });
    }

    await prisma.projectDeal.upsert({
      where: { projectId_dealId: { projectId, dealId: params.id } },
      update: {
        labelEnc: label ? encrypt(label, 'project_deal.label') : undefined,
        notesEnc: notes ? encrypt(notes, 'project_deal.notes') : undefined,
        workstreamId
      },
      create: {
        userId,
        projectId,
        dealId: params.id,
        labelEnc: label ? encrypt(label, 'project_deal.label') : null,
        notesEnc: notes ? encrypt(notes, 'project_deal.notes') : null,
        workstreamId
      }
    });
    throw redirect(303, `/deals/${params.id}`);
  },

  removeProjectLink: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing project link id.' });
    await prisma.projectDeal.deleteMany({ where: { id: linkId, userId: locals.user.id, dealId: params.id } });
    throw redirect(303, `/deals/${params.id}`);
  },

  addContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const userId = locals.user.id;
    const form = await request.formData();
    const contactId = String(form.get('contactId') || '').trim();
    const relationshipType = normaliseDealRelationshipType(form.get('relationshipType'));
    const label = String(form.get('label') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    const nextAction = String(form.get('nextAction') || '').trim();
    const buyingCriteria = String(form.get('buyingCriteria') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    if (!contactId) return fail(400, { error: 'Please select a contact.' });

    const [deal, contact] = await Promise.all([
      ensureOwnedDeal(userId, params.id),
      prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } })
    ]);

    if (!deal || !contact) return fail(404, { error: 'Deal or contact not found.' });

    try {
      await prisma.$transaction(async (tx: any) => {
        if (isPrimary) {
          await tx.dealContact.updateMany({
            where: { userId, dealId: params.id, isPrimary: true },
            data: { isPrimary: false }
          });
        }

        await tx.dealContact.create({
          data: {
            userId,
            dealId: params.id,
            contactId,
            relationshipType: relationshipType as any,
            label: label || (relationshipType ? null : 'connected'),
            notesEnc: notes ? encrypt(notes, 'deal_contact.notes') : null,
            isPrimary,
            stage: normaliseDealContactStage(form.get('stage')) as any,
            interestLevel: normaliseDealContactInterest(form.get('interestLevel')) as any,
            confidentialityStage: normaliseDealConfidentiality(form.get('confidentialityStage')) as any,
            nextActionEnc: nextAction ? encrypt(nextAction, 'deal_contact.next_action') : null,
            nextFollowUpAt: parseDateTime(form.get('nextFollowUpAt')),
            buyingCriteriaEnc: buyingCriteria ? encrypt(buyingCriteria, 'deal_contact.buying_criteria') : null
          }
        });
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'That contact already has that role on this deal.' });
      console.error('[deals:addContact] failed', { message: err?.message, code: err?.code });
      return fail(500, { error: 'Could not add contact to deal.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },

  removeContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const userId = locals.user.id;
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing relationship id.' });

    try {
      await prisma.dealContact.deleteMany({
        where: { id: linkId, userId, dealId: params.id }
      });
    } catch (err) {
      console.error('[deals:removeContact] failed', err);
      return fail(500, { error: 'Could not remove contact from deal.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },

  makePrimary: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const userId = locals.user.id;
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing relationship id.' });

    try {
      await prisma.$transaction([
        prisma.dealContact.updateMany({
          where: { userId, dealId: params.id, isPrimary: true },
          data: { isPrimary: false }
        }),
        prisma.dealContact.updateMany({
          where: { id: linkId, userId, dealId: params.id },
          data: { isPrimary: true }
        })
      ]);
    } catch (err) {
      console.error('[deals:makePrimary] failed', err);
      return fail(500, { error: 'Could not update primary contact.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },


  addCompany: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const companyId = String(form.get('companyId') || '').trim();
    if (!companyId) return fail(400, { error: 'Please select a company.' });

    const [deal, company] = await Promise.all([
      ensureOwnedDeal(userId, params.id),
      prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true } })
    ]);
    if (!deal || !company) return fail(404, { error: 'Deal or company not found.' });

    const label = String(form.get('label') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    const nextAction = String(form.get('nextAction') || '').trim();
    const acquisitionRationale = String(form.get('acquisitionRationale') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    try {
      await prisma.$transaction(async (tx: any) => {
        if (isPrimary) await tx.dealCompany.updateMany({ where: { userId, dealId: params.id, isPrimary: true }, data: { isPrimary: false } });
        await tx.dealCompany.create({
          data: {
            userId,
            dealId: params.id,
            companyId,
            relationshipType: normaliseDealRelationshipType(form.get('relationshipType')) as any,
            label: label || null,
            notesEnc: notes ? encrypt(notes, 'deal_company.notes') : null,
            isPrimary,
            stage: normaliseDealContactStage(form.get('stage')) as any,
            interestLevel: normaliseDealContactInterest(form.get('interestLevel')) as any,
            confidentialityStage: normaliseDealConfidentiality(form.get('confidentialityStage')) as any,
            nextActionEnc: nextAction ? encrypt(nextAction, 'deal_company.next_action') : null,
            nextFollowUpAt: parseDateTime(form.get('nextFollowUpAt')),
            acquisitionRationaleEnc: acquisitionRationale ? encrypt(acquisitionRationale, 'deal_company.acquisition_rationale') : null
          }
        });
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'That company already has that role on this deal.' });
      console.error('[deals:addCompany] failed', err);
      return fail(500, { error: 'Could not add company to deal.' });
    }

    throw redirect(303, `/deals/${params.id}`);
  },

  removeCompany: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing company relationship id.' });
    await prisma.dealCompany.deleteMany({ where: { id: linkId, userId, dealId: params.id } });
    throw redirect(303, `/deals/${params.id}`);
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;

    const deal = await ensureOwnedDeal(userId, params.id);
    if (!deal) return fail(404, { error: 'Deal not found.' });

    const form = await request.formData();
    const result = await createTaskFromForm(userId, form, { dealId: params.id, linkProjectDeal: true });
    if (!result.ok) return fail(result.status, { error: result.error });

    throw redirect(303, `/deals/${params.id}`);
  },


  createExchangeItem: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const exists = await ensureOwnedDeal(userId, params.id);
    if (!exists) return fail(404, { error: 'Deal not found.' });
    try {
      await createExchangeItemFromForm({ userId, form: await request.formData(), links: { dealId: params.id } });
    } catch (err: any) {
      console.error('[deals:createExchangeItem] failed', err);
      return fail(400, { error: err?.message || 'Failed to save want/offer.' });
    }
    throw redirect(303, `/deals/${params.id}`);
  },

  deleteExchangeItem: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const exchangeItemId = String(form.get('exchangeItemId') || '').trim();
    if (!exchangeItemId) return fail(400, { error: 'Missing want/offer id.' });
    await deleteExchangeItem({ userId: locals.user.id, id: exchangeItemId, links: { dealId: params.id } });
    throw redirect(303, `/deals/${params.id}`);
  },

  updateTaskStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    if (!taskId) return fail(400, { error: 'Missing task id.' });

    const data: any = { status, completedAt: status === 'DONE' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null };
    await prisma.task.updateMany({ where: { id: taskId, userId: locals.user.id, dealId: params.id }, data });
    throw redirect(303, `/deals/${params.id}`);
  }
};

// src/routes/companies/[id]/+page.server.ts
// PURPOSE: Company detail page for employees, deal involvement, related companies, and tasks.
// SECURITY: Every read/write is tenant-scoped and company data is encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { resolveOrCreateTagForTenant } from '$lib/tags';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import { createOfferFromForm, deleteOffer, loadOffers } from '$lib/server/offers';
import { createWantFromForm, deleteWant, loadWants } from '$lib/server/wants';
import { loadAgentArtifacts } from '$lib/server/agents/artifacts';
import { ensureCoreAgentSetup } from '$lib/server/agents/agentSetup';
import { runOutreachAgent } from '$lib/server/agents/agents/outreachAgent';
import { runOpportunityScoringAgent } from '$lib/server/agents/agents/opportunityScoringAgent';
import { runContactEnrichmentAgent } from '$lib/server/agents/agents/contactEnrichmentAgent';
import {
  COMPANY_CONTACT_STATUSES,
  COMPANY_KINDS,
  COMPANY_RELATIONSHIP_TYPES,
  COMPANY_STATUSES,
  companyContactStatusLabel,
  companyKindLabel,
  companyRelationshipTypeLabel,
  companyStatusLabel,
  normaliseCompanyContactStatus,
  normaliseCompanyKind,
  normaliseCompanyRelationshipType,
  normaliseCompanyStatus,
  safeDecryptCompany
} from '$lib/companies';
import {
  DEAL_RELATIONSHIP_TYPES,
  dealRelationshipLabel,
  dealStatusLabel,
  normaliseDealRelationshipType,
  safeDecrypt
} from '$lib/deals';
import {
  DEAL_CONFIDENTIALITY_STAGES,
  DEAL_CONTACT_INTERESTS,
  DEAL_CONTACT_STAGES,
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
import {
  MARKET_LEAD_STATUSES,
  MARKET_LEAD_TYPES,
  NOTE_CHANNELS,
  dateToDatetimeLocal,
  normaliseNoteChannel,
  noteChannelLabel,
  parseDateTime as parseLeadDateTime
} from '$lib/marketLeads';
import {
  buildLeadSourceOptions,
  leadFormValues,
  loadLeadSources,
  mapMarketLead,
  marketLeadCreateData,
  resolveLeadSourceId
} from '$lib/server/marketLeads';
import { createTaskFromForm } from '$lib/server/tasks';
import { decryptCompanyExternalIdentifier, decryptCompanyExternalSourceUrl } from '$lib/server/leadImport';

const ACTIVE_TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];

async function ensureCompany(userId: string, companyId: string) {
  return prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true, nameEnc: true, websiteEnc: true, phoneEnc: true } });
}

function mapCompanyNote(note: any) {
  return {
    id: note.id,
    body: safeDecryptTask(note.bodyEnc, 'company_note.body', ''),
    summary: safeDecryptTask(note.summaryEnc, 'company_note.summary', ''),
    channel: note.channel || 'note',
    channelLabel: noteChannelLabel(note.channel),
    occurredAt: note.occurredAt || note.createdAt,
    occurredAtInput: dateToDatetimeLocal(note.occurredAt || note.createdAt),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

const marketLeadSelect = {
  id: true,
  titleEnc: true,
  nameEnc: true,
  companyNameEnc: true,
  emailEnc: true,
  phoneEnc: true,
  websiteEnc: true,
  linkedinEnc: true,
  roleTitleEnc: true,
  geographyEnc: true,
  addressEnc: true,
  descriptionEnc: true,
  notesEnc: true,
  sourceUrlEnc: true,
  nextActionEnc: true,
  nextActionAt: true,
  type: true,
  status: true,
  source: true,
  leadSourceId: true,
  leadSource: { select: { id: true, nameEnc: true } },
  usualCommunicationMethod: true,
  contactAttemptStatus: true,
  lastContactedAt: true,
  buyerStatus: true,
  sellerStatus: true,
  confidence: true,
  priority: true,
  valueMinCents: true,
  valueMaxCents: true,
  currency: true,
  contactId: true,
  companyId: true,
  dealId: true,
  projectId: true,
  workstreamId: true,
  workstream: { select: { id: true, nameEnc: true, projectId: true, status: true } },
  offerId: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  contact: { select: { id: true, fullNameEnc: true } },
  company: { select: { id: true, nameEnc: true } },
  deal: { select: { id: true, titleEnc: true } },
  project: { select: { id: true, titleEnc: true } }
};

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const row = await prisma.company.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      nameEnc: true,
      websiteEnc: true,
      phoneEnc: true,
      industryEnc: true,
      locationEnc: true,
      descriptionEnc: true,
      criteriaEnc: true,
      notesEnc: true,
      kind: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      tags: { select: { id: true, tagId: true, tag: { select: { name: true } } }, orderBy: { assignedAt: 'desc' } },
      contacts: {
        select: {
          id: true,
          titleEnc: true,
          departmentEnc: true,
          notesEnc: true,
          status: true,
          isPrimary: true,
          contact: { select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, linkedUserId: true } }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }]
      },
      dealLinks: {
        select: {
          id: true,
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
          deal: { select: { id: true, titleEnc: true, status: true, probability: true, expectedCloseDate: true } }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }]
      },
      relationshipsAsA: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          notesEnc: true,
          companyB: { select: { id: true, nameEnc: true, kind: true, status: true } }
        }
      },
      relationshipsAsB: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          notesEnc: true,
          companyA: { select: { id: true, nameEnc: true, kind: true, status: true } }
        }
      }
    }
  });

  if (!row) throw redirect(303, '/companies');

  const employees = await Promise.all(row.contacts.map(async (link: any) => ({
    id: link.id,
    contactId: link.contact.id,
    name: await contactDisplayName(link.contact),
    email: safeDecrypt(link.contact.emailEnc, 'contact.email', ''),
    phone: safeDecrypt(link.contact.phoneEnc, 'contact.phone', ''),
    title: safeDecryptCompany(link.titleEnc, 'company_contact.title', ''),
    department: safeDecryptCompany(link.departmentEnc, 'company_contact.department', ''),
    notes: safeDecryptCompany(link.notesEnc, 'company_contact.notes', ''),
    status: link.status,
    statusLabel: companyContactStatusLabel(link.status),
    isPrimary: link.isPrimary
  })));

  const dealLinks = row.dealLinks.map((link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    dealTitle: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
    dealStatusLabel: dealStatusLabel(link.deal.status),
    probability: link.deal.probability,
    expectedCloseDate: link.deal.expectedCloseDate,
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
    nextFollowUpAtInput: dateTimeToInputValue(link.nextFollowUpAt),
    lastContactedAt: link.lastContactedAt,
    acquisitionRationale: safeDecryptCompany(link.acquisitionRationaleEnc, 'deal_company.acquisition_rationale', ''),
    objections: safeDecryptCompany(link.objectionsEnc, 'deal_company.objections', ''),
    fundingCapacity: safeDecryptCompany(link.fundingCapacityEnc, 'deal_company.funding_capacity', ''),
    referralPath: safeDecryptCompany(link.referralPathEnc, 'deal_company.referral_path', ''),
    taskCount: link._count?.tasks || 0
  }));

  const relationships = [
    ...row.relationshipsAsA.map((rel: any) => ({
      id: rel.id,
      otherCompanyId: rel.companyB.id,
      otherCompanyName: safeDecryptCompany(rel.companyB.nameEnc, 'company.name', 'Untitled company'),
      otherKindLabel: companyKindLabel(rel.companyB.kind),
      otherStatusLabel: companyStatusLabel(rel.companyB.status),
      relationshipType: rel.relationshipType,
      relationshipLabel: companyRelationshipTypeLabel(rel.relationshipType, rel.label),
      notes: safeDecryptCompany(rel.notesEnc, 'company_relationship.notes', '')
    })),
    ...row.relationshipsAsB.map((rel: any) => ({
      id: rel.id,
      otherCompanyId: rel.companyA.id,
      otherCompanyName: safeDecryptCompany(rel.companyA.nameEnc, 'company.name', 'Untitled company'),
      otherKindLabel: companyKindLabel(rel.companyA.kind),
      otherStatusLabel: companyStatusLabel(rel.companyA.status),
      relationshipType: rel.relationshipType,
      relationshipLabel: companyRelationshipTypeLabel(rel.relationshipType, rel.label),
      notes: safeDecryptCompany(rel.notesEnc, 'company_relationship.notes', '')
    }))
  ];

  const tasksRaw = await prisma.task.findMany({
    where: { userId, companyId: row.id, status: { in: ACTIVE_TASK_STATUSES as any } },
    select: {
      id: true,
      titleEnc: true,
      notesEnc: true,
      summaryEnc: true,
      status: true,
      urgency: true,
      importance: true,
      focus: true,
      taskType: true,
      dueAt: true,
      deal: { select: { id: true, titleEnc: true } },
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
    },
    orderBy: [{ focus: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
    take: 40
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
    deal: task.deal ? { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal') } : null,
    contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null
  })));

  const companyNotesRaw = await prisma.companyNote.findMany({
    where: { userId, companyId: row.id },
    select: { id: true, channel: true, occurredAt: true, bodyEnc: true, summaryEnc: true, createdAt: true, updatedAt: true },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 120
  });
  const companyNotes = companyNotesRaw.map(mapCompanyNote);

  // IT: Imported research remains authoritative on the lead that motivated the call, but the
  // Company page surfaces that history so later batches can see what was previously known.
  const [externalIdentifierRows, leadResearchRows] = await Promise.all([
    (prisma as any).companyExternalIdentifier.findMany({
      where: { userId, companyId: row.id },
      select: { id: true, scheme: true, valueEnc: true, sourceUrlEnc: true, createdAt: true },
      orderBy: [{ scheme: 'asc' }, { createdAt: 'asc' }]
    }),
    prisma.marketLeadNote.findMany({
      where: { userId, channel: 'research', marketLead: { companyId: row.id } },
      select: {
        id: true,
        occurredAt: true,
        bodyEnc: true,
        createdAt: true,
        marketLead: { select: { id: true, titleEnc: true, leadSource: { select: { nameEnc: true } } } }
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 80
    })
  ]);
  const externalIdentifiers = externalIdentifierRows.map((identifier: any) => ({
    id: identifier.id,
    scheme: identifier.scheme,
    value: decryptCompanyExternalIdentifier(identifier.valueEnc, ''),
    sourceUrl: decryptCompanyExternalSourceUrl(identifier.sourceUrlEnc, ''),
    createdAt: identifier.createdAt
  }));
  const leadResearchHistory = leadResearchRows.map((note: any) => ({
    id: note.id,
    leadId: note.marketLead.id,
    leadTitle: safeDecryptTask(note.marketLead.titleEnc, 'market_lead.title', 'Untitled lead'),
    batchName: safeDecryptTask(note.marketLead.leadSource?.nameEnc, 'lead_source.name', 'Imported lead'),
    body: safeDecryptTask(note.bodyEnc, 'market_lead_note.body', ''),
    occurredAt: note.occurredAt || note.createdAt
  }));

  const offers = await loadOffers({ userId, links: { companyId: row.id } });
  const wants = await loadWants({ userId, links: { companyId: row.id } });
  const agentArtifacts = await loadAgentArtifacts({ userId, entityType: 'company', entityId: row.id });

  const [contactsRaw, dealsRaw, companiesRaw, linkedLeadsRaw, leadOptionsRaw, customLeadSources] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.company.findMany({ where: { userId, id: { not: row.id } }, select: { id: true, nameEnc: true, kind: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.marketLead.findMany({ where: { userId, companyId: row.id, status: { not: 'ARCHIVED' as any } }, select: marketLeadSelect as any, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }], take: 150 }),
    prisma.marketLead.findMany({ where: { userId, companyId: null, status: { notIn: ['ARCHIVED', 'CONVERTED'] as any } }, select: marketLeadSelect as any, orderBy: [{ updatedAt: 'desc' }], take: 500 }),
    loadLeadSources(userId)
  ]);

  const contactOptionNames = await contactOptionsForRows(contactsRaw as any);
  const contactOptions = contactOptionNames.map((contact: any, index: number) => ({
    ...contact,
    email: safeDecrypt(contactsRaw[index]?.emailEnc, 'contact.email', ''),
    phone: safeDecrypt(contactsRaw[index]?.phoneEnc, 'contact.phone', '')
  }));
  const attachedContactIds = new Set(row.contacts.map((link: any) => link.contact.id));
  const dealOptions = dealsRaw.map((deal: any) => ({ id: deal.id, title: safeDecrypt(deal.titleEnc, 'deal.title', 'Untitled deal'), statusLabel: dealStatusLabel(deal.status) }));
  const attachedDealIds = new Set(row.dealLinks.map((link: any) => link.deal.id));
  const companyOptions = companiesRaw.map((company: any) => ({ id: company.id, name: safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company'), kindLabel: companyKindLabel(company.kind) }));
  const linkedLeads = linkedLeadsRaw.map(mapMarketLead);
  const leadOptions = leadOptionsRaw.map(mapMarketLead);

  // IT: full canonical picker option lists for TasksPanel - see src/lib/TasksPanel.svelte.
  const projectsForTasksRaw = await prisma.project.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any } },
    select: { id: true, titleEnc: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: 200
  });
  const taskProjectOptions = projectsForTasksRaw.map((p: any) => ({ id: p.id, title: safeDecryptTask(p.titleEnc, 'project.title', 'Untitled project') }));

  const workstreamsForTasksRaw = await prisma.projectWorkstream.findMany({
    where: { userId, status: { not: 'ARCHIVED' as any } },
    select: { id: true, nameEnc: true, projectId: true, status: true, sortOrder: true, project: { select: { id: true, titleEnc: true } } },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    take: 300
  });
  const taskWorkstreamOptions = workstreamsForTasksRaw.map((ws: any) => ({
    id: ws.id,
    name: safeDecryptTask(ws.nameEnc, 'project_workstream.name', 'Untitled workstream'),
    projectId: ws.projectId,
    projectTitle: safeDecryptTask(ws.project?.titleEnc, 'project.title', 'Untitled project')
  }));

  const taskMarketLeadOptions = linkedLeads.map((lead: any) => ({ id: lead.id, title: lead.title, statusLabel: lead.statusLabel }));

  // IT: this company's own deal threads - already loaded above as `dealLinks`.
  const dealCompanyOptions = dealLinks.map((link: any) => ({ id: link.id, dealId: link.dealId, title: `${link.dealTitle}${link.label ? ` (${link.label})` : ''}` }));

  const dealContactsForTasksRaw = await prisma.dealContact.findMany({
    where: { userId },
    select: { id: true, label: true, deal: { select: { id: true, titleEnc: true } }, contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 300
  });
  const dealContactOptions = await Promise.all(dealContactsForTasksRaw.map(async (link: any) => ({
    id: link.id,
    dealId: link.deal.id,
    title: `${safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal')} - ${await contactDisplayName(link.contact)}${link.label ? ` (${link.label})` : ''}`
  })));

  return {
    company: {
      id: row.id,
      name: safeDecryptCompany(row.nameEnc, 'company.name', 'Untitled company'),
      website: safeDecryptCompany(row.websiteEnc, 'company.website', ''),
      phone: safeDecryptCompany(row.phoneEnc, 'company.phone', ''),
      tags: (row.tags || []).map((ct: any) => ({ id: ct.id, name: ct.tag.name })),
      industry: safeDecryptCompany(row.industryEnc, 'company.industry', ''),
      location: safeDecryptCompany(row.locationEnc, 'company.location', ''),
      description: safeDecryptCompany(row.descriptionEnc, 'company.description', ''),
      criteria: safeDecryptCompany(row.criteriaEnc, 'company.criteria', ''),
      notes: safeDecryptCompany(row.notesEnc, 'company.notes', ''),
      kind: row.kind,
      kindLabel: companyKindLabel(row.kind),
      status: row.status,
      statusLabel: companyStatusLabel(row.status),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    },
    employees,
    dealLinks,
    relationships,
    tasks,
    companyNotes,
    externalIdentifiers,
    leadResearchHistory,
    linkedLeads,
    leadOptions,
    wants,
    offers,
    agentArtifacts,
    contactOptions: contactOptions.filter((contact: any) => !attachedContactIds.has(contact.id)),
    allContactOptions: contactOptions,
    dealOptions: dealOptions.filter((deal: any) => !attachedDealIds.has(deal.id)),
    allDealOptions: dealOptions,
    companyOptions,
    taskProjectOptions,
    taskWorkstreamOptions,
    taskMarketLeadOptions,
    dealContactOptions,
    dealCompanyOptions,
    companyKinds: COMPANY_KINDS,
    companyStatuses: COMPANY_STATUSES,
    companyContactStatuses: COMPANY_CONTACT_STATUSES,
    companyRelationshipTypes: COMPANY_RELATIONSHIP_TYPES,
    relationshipOptions: DEAL_RELATIONSHIP_TYPES,
    dealContactStageOptions: DEAL_CONTACT_STAGES,
    dealContactInterestOptions: DEAL_CONTACT_INTERESTS,
    dealConfidentialityOptions: DEAL_CONFIDENTIALITY_STAGES,
    taskStatuses: TASK_STATUSES,
    taskUrgencies: TASK_URGENCIES,
    taskImportances: TASK_IMPORTANCES,
    taskFocusOptions: TASK_FOCUS_OPTIONS,
    taskTypes: TASK_TYPES,
    noteChannels: NOTE_CHANNELS,
    leadTypes: MARKET_LEAD_TYPES,
    leadStatuses: MARKET_LEAD_STATUSES,
    leadSourceOptions: buildLeadSourceOptions(customLeadSources)
  };
};

export const actions: Actions = {
  createCompanyNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    if (!(await ensureCompany(userId, params.id))) return fail(404, { error: 'Company not found.' });
    const form = await request.formData();
    const body = String(form.get('body') || form.get('note') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const channel = normaliseNoteChannel(form.get('channel'));
    const occurredAt = parseLeadDateTime(form.get('occurredAt')) || new Date();
    if (!body) return fail(400, { error: 'Company note is required.' });
    await prisma.companyNote.create({
      data: {
        userId,
        companyId: params.id,
        channel,
        occurredAt,
        bodyEnc: encrypt(body, 'company_note.body'),
        summaryEnc: summary ? encrypt(summary, 'company_note.summary') : null
      }
    });
    throw redirect(303, `/companies/${params.id}`);
  },

  updateCompanyNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const noteId = String(form.get('noteId') || '').trim();
    const body = String(form.get('body') || '').trim();
    const summary = String(form.get('summary') || '').trim();
    const channel = normaliseNoteChannel(form.get('channel'));
    const occurredAt = parseLeadDateTime(form.get('occurredAt')) || new Date();
    if (!noteId) return fail(400, { error: 'Missing company note id.' });
    if (!body) return fail(400, { error: 'Company note is required.' });
    await prisma.companyNote.updateMany({
      where: { id: noteId, userId, companyId: params.id },
      data: {
        channel,
        occurredAt,
        bodyEnc: encrypt(body, 'company_note.body'),
        summaryEnc: summary ? encrypt(summary, 'company_note.summary') : null
      }
    });
    throw redirect(303, `/companies/${params.id}`);
  },

  deleteCompanyNote: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const noteId = String((await request.formData()).get('noteId') || '').trim();
    if (!noteId) return fail(400, { error: 'Missing company note id.' });
    await prisma.companyNote.deleteMany({ where: { id: noteId, userId: locals.user.id, companyId: params.id } });
    throw redirect(303, `/companies/${params.id}`);
  },

  createCompanyLead: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const company = await ensureCompany(userId, params.id);
    if (!company) return fail(404, { error: 'Company not found.' });
    const companyName = safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company');
    const website = safeDecryptCompany(company.websiteEnc, 'company.website', '');
    const phone = safeDecryptCompany(company.phoneEnc, 'company.phone', '');
    const values = leadFormValues(await request.formData(), {
      title: companyName,
      companyName,
      website,
      phone,
      type: 'COMPANY',
      status: 'NEW',
      source: 'MANUAL'
    });
    values.title = values.title || companyName;
    values.companyName = values.companyName || companyName;
    values.website = values.website || website;
    values.phone = values.phone || phone;
    values.leadSourceId = (await resolveLeadSourceId(userId, values.leadSourceId, values.newLeadSource)) || '';
    await prisma.marketLead.create({ data: { ...marketLeadCreateData(userId, values), companyId: params.id } as any });
    throw redirect(303, `/companies/${params.id}`);
  },

  attachLead: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const leadId = String(form.get('leadId') || '').trim();
    if (!leadId) return fail(400, { error: 'Please select a lead.' });
    const [company, lead] = await Promise.all([
      ensureCompany(userId, params.id),
      prisma.marketLead.findFirst({ where: { id: leadId, userId }, select: { id: true, companyNameEnc: true, status: true } })
    ]);
    if (!company || !lead) return fail(404, { error: 'Company or lead not found.' });
    const companyName = safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company');
    const data: any = { companyId: params.id };
    if (!lead.companyNameEnc) {
      data.companyNameEnc = encrypt(companyName, 'market_lead.company_name');
      data.companyNameIdx = buildIndexToken(companyName);
    }
    await prisma.marketLead.updateMany({ where: { id: leadId, userId }, data });
    await prisma.task.updateMany({ where: { userId, marketLeadId: leadId, companyId: null }, data: { companyId: params.id } }).catch(() => null);
    throw redirect(303, `/companies/${params.id}`);
  },

  detachLead: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const leadId = String((await request.formData()).get('leadId') || '').trim();
    if (!leadId) return fail(400, { error: 'Missing lead id.' });
    await prisma.marketLead.updateMany({ where: { id: leadId, userId: locals.user.id, companyId: params.id }, data: { companyId: null } });
    throw redirect(303, `/companies/${params.id}`);
  },

  enrichCompany: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const company = await ensureCompany(locals.user.id, params.id);
    if (!company) return fail(404, { error: 'Company not found.' });
    const run = await runContactEnrichmentAgent({
      userId: locals.user.id,
      entityType: 'company',
      entityId: params.id,
      enableWebResearch: true,
      mode: 'company',
      enrichmentGoal: 'Find evidence-backed company details such as website, industry, location, services, description, ownership signals, and source evidence. Stage field-level company updates for review before applying to CRM.'
    });
    throw redirect(303, `/agents/runs/${run.id}`);
  },

  findCompanyContacts: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const company = await ensureCompany(locals.user.id, params.id);
    if (!company) return fail(404, { error: 'Company not found.' });
    const run = await runContactEnrichmentAgent({
      userId: locals.user.id,
      entityType: 'company',
      entityId: params.id,
      enableWebResearch: true,
      mode: 'find_contacts',
      enrichmentGoal: 'Find source-supported people connected to this company, such as owner, founder, director, CEO, principal broker, or broker. Stage only evidence-backed contact fields. If no supported person is found, return no enrichments.'
    });
    throw redirect(303, `/agents/runs/${run.id}`);
  },

  scoreCompany: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const company = await ensureCompany(locals.user.id, params.id);
    if (!company) return fail(404, { error: 'Company not found.' });
    const run = await runOpportunityScoringAgent({
      userId: locals.user.id,
      entityType: 'company',
      entityId: params.id,
      sector: 'Business broking target',
      scoringGoal: 'Prioritise this company for relationship-driven business-broker outreach or deal work.'
    });
    throw redirect(303, `/agents/runs/${run.id}`);
  },

  updateCompany: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    if (!(await ensureCompany(userId, params.id))) return fail(404, { error: 'Company not found.' });

    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    if (!name) return fail(400, { error: 'Company name is required.' });
    const website = String(form.get('website') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const industry = String(form.get('industry') || '').trim();
    const location = String(form.get('location') || '').trim();
    const description = String(form.get('description') || '').trim();
    const notes = String(form.get('notes') || '').trim();

    try {
      await prisma.company.updateMany({
        where: { id: params.id, userId },
        data: {
          nameEnc: encrypt(name, 'company.name'),
          nameIdx: buildIndexToken(name),
          websiteEnc: website ? encrypt(website, 'company.website') : null,
          websiteIdx: website ? buildIndexToken(website) : null,
          phoneEnc: phone ? encrypt(phone, 'company.phone') : null,
          phoneIdx: phone ? buildIndexToken(phone) : null,
          industryEnc: industry ? encrypt(industry, 'company.industry') : null,
          locationEnc: location ? encrypt(location, 'company.location') : null,
          descriptionEnc: description ? encrypt(description, 'company.description') : null,
          notesEnc: notes ? encrypt(notes, 'company.notes') : null,
          kind: normaliseCompanyKind(form.get('kind')) as any,
          status: normaliseCompanyStatus(form.get('status')) as any
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'Another company already uses this name.' });
      console.error('[companies:updateCompany] failed', err);
      return fail(500, { error: 'Could not update company.' });
    }
    throw redirect(303, `/companies/${params.id}`);
  },

  addCompanyTag: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    if (!(await ensureCompany(userId, params.id))) return fail(404, { error: 'Company not found.' });
    const form = await request.formData();
    const tagName = String(form.get('tag') || '').trim();
    if (!tagName) return fail(400, { error: 'Tag is required.' });
    const tag = await resolveOrCreateTagForTenant(userId, tagName, 'user');
    await prisma.companyTag.upsert({
      where: { companyId_tagId: { companyId: params.id, tagId: tag.id } },
      update: {},
      create: { userId, companyId: params.id, tagId: tag.id, assignedBy: 'user' as any }
    });
    throw redirect(303, `/companies/${params.id}`);
  },

  removeCompanyTag: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing tag link id.' });
    await prisma.companyTag.deleteMany({ where: { id: linkId, userId: locals.user.id, companyId: params.id } });
    throw redirect(303, `/companies/${params.id}`);
  },

  createWant: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    try {
      await createWantFromForm({ userId, form: await request.formData(), links: { companyId: params.id } });
    } catch (err: any) {
      console.error('[wants:createWant] failed', err);
      return fail(400, { error: err?.message || 'Failed to save want.' });
    }
    throw redirect(303, `/companies/${params.id}`);
  },

  deleteWant: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const wantId = String(form.get('wantId') || '').trim();
    if (!wantId) return fail(400, { error: 'Missing want id.' });
    await deleteWant({ userId: locals.user.id, id: wantId, links: { companyId: params.id } });
    throw redirect(303, `/companies/${params.id}`);
  },

  createOffer: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const exists = await ensureCompany(userId, params.id);
    if (!exists) return fail(404, { error: 'Company not found.' });
    try {
      await createOfferFromForm({ userId, form: await request.formData(), links: { companyId: params.id } });
    } catch (err: any) {
      console.error('[companies:createOffer] failed', err);
      return fail(400, { error: err?.message || 'Failed to save want/offer.' });
    }
    throw redirect(303, `/companies/${params.id}`);
  },

  deleteOffer: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const offerId = String(form.get('offerId') || '').trim();
    if (!offerId) return fail(400, { error: 'Missing want/offer id.' });
    await deleteOffer({ userId: locals.user.id, id: offerId, links: { companyId: params.id } });
    throw redirect(303, `/companies/${params.id}`);
  },

  addContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const contactId = String(form.get('contactId') || '').trim();
    if (!contactId) return fail(400, { error: 'Please select a contact.' });
    const [company, contact] = await Promise.all([
      ensureCompany(userId, params.id),
      prisma.contact.findFirst({ where: { id: contactId, userId }, select: { id: true } })
    ]);
    if (!company || !contact) return fail(404, { error: 'Company or contact not found.' });

    const title = String(form.get('title') || '').trim();
    const department = String(form.get('department') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    try {
      await prisma.$transaction(async (tx: any) => {
        if (isPrimary) {
          await tx.companyContact.updateMany({ where: { userId, companyId: params.id, isPrimary: true }, data: { isPrimary: false } });
        }
        await tx.companyContact.create({
          data: {
            userId,
            companyId: params.id,
            contactId,
            titleEnc: title ? encrypt(title, 'company_contact.title') : null,
            departmentEnc: department ? encrypt(department, 'company_contact.department') : null,
            notesEnc: notes ? encrypt(notes, 'company_contact.notes') : null,
            status: normaliseCompanyContactStatus(form.get('status')) as any,
            isPrimary
          }
        });
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'That contact is already attached to this company.' });
      console.error('[companies:addContact] failed', err);
      return fail(500, { error: 'Could not add contact.' });
    }
    throw redirect(303, `/companies/${params.id}`);
  },

  // IT: creates a brand new contact (not selected from the existing list) and attaches it to
  // this company in one step, following the same encrypt/buildIndexToken conventions as
  // src/routes/contacts/new/+page.server.ts.
  createAndLinkContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const company = await ensureCompany(userId, params.id);
    if (!company) return fail(404, { error: 'Company not found.' });

    const form = await request.formData();
    const fullName = String(form.get('fullName') || '').trim();
    if (!fullName) return fail(400, { error: 'Contact name is required.' });

    const email = String(form.get('email') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const position = String(form.get('position') || '').trim();
    const linkedin = String(form.get('linkedin') || '').trim();

    const title = String(form.get('title') || '').trim();
    const department = String(form.get('department') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    const contactData: any = {
      userId,
      fullNameEnc: encrypt(fullName, 'contact.full_name'),
      fullNameIdx: buildIndexToken(fullName)
    };
    if (email) {
      contactData.emailEnc = encrypt(email, 'contact.email');
      contactData.emailIdx = buildIndexToken(email);
    }
    if (phone) {
      contactData.phoneEnc = encrypt(phone, 'contact.phone');
      contactData.phoneIdx = buildIndexToken(phone);
    }
    if (position) {
      contactData.positionEnc = encrypt(position, 'contact.position');
    }
    if (linkedin) {
      contactData.linkedinEnc = encrypt(linkedin, 'contact.linkedin');
      contactData.linkedinIdx = buildIndexToken(linkedin);
    }

    try {
      await prisma.$transaction(async (tx: any) => {
        const contact = await tx.contact.create({ data: contactData, select: { id: true } });
        if (isPrimary) {
          await tx.companyContact.updateMany({ where: { userId, companyId: params.id, isPrimary: true }, data: { isPrimary: false } });
        }
        await tx.companyContact.create({
          data: {
            userId,
            companyId: params.id,
            contactId: contact.id,
            titleEnc: title ? encrypt(title, 'company_contact.title') : null,
            departmentEnc: department ? encrypt(department, 'company_contact.department') : null,
            notesEnc: notes ? encrypt(notes, 'company_contact.notes') : null,
            status: normaliseCompanyContactStatus(form.get('status')) as any,
            isPrimary
          }
        });
      });
    } catch (err: any) {
      console.error('[companies:createAndLinkContact] failed', err);
      return fail(500, { error: 'Could not create and link contact.' });
    }

    throw redirect(303, `/companies/${params.id}`);
  },

  updateContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    if (!linkId) return fail(400, { error: 'Missing relationship id.' });
    // IT: scope the lookup by userId + companyId so a linkId belonging to another tenant/company can't be edited.
    const existing = await prisma.companyContact.findFirst({ where: { id: linkId, userId, companyId: params.id }, select: { id: true } });
    if (!existing) return fail(404, { error: 'Contact relationship not found.' });

    const title = String(form.get('title') || '').trim();
    const department = String(form.get('department') || '').trim();
    const notes = String(form.get('notes') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    await prisma.$transaction(async (tx: any) => {
      if (isPrimary) {
        await tx.companyContact.updateMany({ where: { userId, companyId: params.id, isPrimary: true }, data: { isPrimary: false } });
      }
      await tx.companyContact.update({
        where: { id: existing.id },
        data: {
          titleEnc: title ? encrypt(title, 'company_contact.title') : null,
          departmentEnc: department ? encrypt(department, 'company_contact.department') : null,
          notesEnc: notes ? encrypt(notes, 'company_contact.notes') : null,
          status: normaliseCompanyContactStatus(form.get('status')) as any,
          isPrimary
        }
      });
    });

    throw redirect(303, `/companies/${params.id}`);
  },

  removeContact: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    await prisma.companyContact.deleteMany({ where: { id: linkId, userId: locals.user.id, companyId: params.id } });
    throw redirect(303, `/companies/${params.id}`);
  },

  addDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const dealId = String(form.get('dealId') || '').trim();
    if (!dealId) return fail(400, { error: 'Please select a deal.' });
    const [company, deal] = await Promise.all([
      ensureCompany(userId, params.id),
      prisma.deal.findFirst({ where: { id: dealId, userId }, select: { id: true } })
    ]);
    if (!company || !deal) return fail(404, { error: 'Company or deal not found.' });

    const label = String(form.get('label') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    const nextAction = String(form.get('nextAction') || '').trim();
    const acquisitionRationale = String(form.get('acquisitionRationale') || '').trim();
    const isPrimary = String(form.get('isPrimary') || '') === 'on';

    try {
      await prisma.$transaction(async (tx: any) => {
        if (isPrimary) await tx.dealCompany.updateMany({ where: { userId, dealId, isPrimary: true }, data: { isPrimary: false } });
        await tx.dealCompany.create({
          data: {
            userId,
            dealId,
            companyId: params.id,
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
      if (err?.code === 'P2002') return fail(409, { error: 'This company is already attached to that deal with that label.' });
      console.error('[companies:addDeal] failed', err);
      return fail(500, { error: 'Could not attach deal.' });
    }
    throw redirect(303, `/companies/${params.id}`);
  },

  removeDeal: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const linkId = String(form.get('linkId') || '').trim();
    await prisma.dealCompany.deleteMany({ where: { id: linkId, userId: locals.user.id, companyId: params.id } });
    throw redirect(303, `/companies/${params.id}`);
  },

  addRelationship: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const form = await request.formData();
    const otherCompanyId = String(form.get('otherCompanyId') || '').trim();
    if (!otherCompanyId || otherCompanyId === params.id) return fail(400, { error: 'Please select another company.' });
    const [company, other] = await Promise.all([
      ensureCompany(userId, params.id),
      prisma.company.findFirst({ where: { id: otherCompanyId, userId }, select: { id: true } })
    ]);
    if (!company || !other) return fail(404, { error: 'Company not found.' });

    const label = String(form.get('label') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    try {
      await prisma.companyRelationship.create({
        data: {
          userId,
          companyAId: params.id,
          companyBId: otherCompanyId,
          relationshipType: normaliseCompanyRelationshipType(form.get('relationshipType')) as any,
          label: label || null,
          notesEnc: notes ? encrypt(notes, 'company_relationship.notes') : null,
          isDirectional: true
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return fail(409, { error: 'That company relationship already exists.' });
      console.error('[companies:addRelationship] failed', err);
      return fail(500, { error: 'Could not add company relationship.' });
    }
    throw redirect(303, `/companies/${params.id}`);
  },

  removeRelationship: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const relationshipId = String(form.get('relationshipId') || '').trim();
    await prisma.companyRelationship.deleteMany({
      where: { id: relationshipId, userId: locals.user.id, OR: [{ companyAId: params.id }, { companyBId: params.id }] }
    });
    throw redirect(303, `/companies/${params.id}`);
  },

  createTask: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    if (!(await ensureCompany(userId, params.id))) return fail(404, { error: 'Company not found.' });

    const form = await request.formData();
    const result = await createTaskFromForm(userId, form, { companyId: params.id });
    if (!result.ok) return fail(result.status, { error: result.error });

    throw redirect(303, `/companies/${params.id}`);
  },


  researchCompany: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const company = await prisma.company.findFirst({
      where: { id: params.id, userId },
      select: { id: true, nameEnc: true, websiteEnc: true, industryEnc: true, locationEnc: true, descriptionEnc: true, criteriaEnc: true }
    });
    if (!company) return fail(404, { error: 'Company not found.' });

    const form = await request.formData();
    await ensureCoreAgentSetup(userId);

    const companyName = safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company');
    const website = safeDecryptCompany(company.websiteEnc, 'company.website', '');
    const industry = safeDecryptCompany(company.industryEnc, 'company.industry', '');
    const location = safeDecryptCompany(company.locationEnc, 'company.location', '');
    const description = safeDecryptCompany(company.descriptionEnc, 'company.description', '');
    const criteriaWants = await loadWants({ userId, links: { companyId: params.id }, take: 50 });
    const criteria = criteriaWants
      .filter((want: any) => want.wantType === 'ACQUISITION_CRITERIA')
      .map((want: any) => want.criteria || want.description || want.summary || want.title)
      .filter(Boolean)
      .join('\n\n') || safeDecryptCompany(company.criteriaEnc, 'company.criteria', '');

    const run = await runOutreachAgent({
      userId,
      sector: industry || companyName,
      geography: location || undefined,
      targetDescription: `Research this existing target company and identify likely owner/director/CEO/principal contacts. Company: ${companyName}. Website: ${website || 'unknown'}. Criteria/context: ${criteria || description || 'not specified'}.`,
      outreachGoal: 'Research likely contact names and stage any supported contact candidates for human review before import.',
      sourceText: [`Company: ${companyName}`, website ? `Website: ${website}` : '', description ? `Description: ${description}` : '', criteria ? `Criteria: ${criteria}` : ''].filter(Boolean).join('\n'),
      maxCandidates: 8,
      enableWebResearch: true,
      findContacts: true,
      researchProvider: String(form.get('researchProvider') || '').trim() || undefined
    });

    await prisma.agentRunEntity.create({ data: { agentRunId: run.id, entityType: 'company', entityId: params.id, role: 'research_target' } });
    throw redirect(303, `/agents/runs/${run.id}`);
  },

  updateTaskStatus: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const taskId = String(form.get('taskId') || '').trim();
    const status = normaliseTaskStatus(form.get('status'));
    const data: any = { status, completedAt: status === 'DONE' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null };
    await prisma.task.updateMany({ where: { id: taskId, userId: locals.user.id, companyId: params.id }, data });
    throw redirect(303, `/companies/${params.id}`);
  }
};

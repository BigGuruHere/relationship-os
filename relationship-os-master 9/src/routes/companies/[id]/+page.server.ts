// src/routes/companies/[id]/+page.server.ts
// PURPOSE: Company detail page for employees, deal involvement, related companies, and tasks.
// SECURITY: Every read/write is tenant-scoped and company data is encrypted at rest.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildIndexToken, encrypt } from '$lib/crypto';
import { contactDisplayName, contactOptionsForRows } from '$lib/server/contactDisplay';
import { createExchangeItemFromForm, deleteExchangeItem, loadExchangeItems } from '$lib/server/exchange';
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
  normaliseTaskImportance,
  normaliseTaskStatus,
  normaliseTaskType,
  normaliseTaskUrgency,
  parseDateTime,
  projectStatusLabel,
  safeDecryptTask,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';

const ACTIVE_TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'];

async function ensureCompany(userId: string, companyId: string) {
  return prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true } });
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const row = await prisma.company.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      nameEnc: true,
      websiteEnc: true,
      industryEnc: true,
      locationEnc: true,
      descriptionEnc: true,
      criteriaEnc: true,
      notesEnc: true,
      kind: true,
      status: true,
      createdAt: true,
      updatedAt: true,
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
      taskType: true,
      dueAt: true,
      deal: { select: { id: true, titleEnc: true } },
      contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
      waitingOnContact: { select: { id: true, fullNameEnc: true, linkedUserId: true } }
    },
    orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
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
    taskTypeLabel: taskTypeLabel(task.taskType),
    dueAt: task.dueAt,
    deal: task.deal ? { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal') } : null,
    contact: task.contact ? { id: task.contact.id, name: await contactDisplayName(task.contact) } : null,
    waitingOnContact: task.waitingOnContact ? { id: task.waitingOnContact.id, name: await contactDisplayName(task.waitingOnContact) } : null
  })));

  const exchangeItems = await loadExchangeItems({ userId, links: { companyId: row.id } });
  const agentArtifacts = await loadAgentArtifacts({ userId, entityType: 'company', entityId: row.id });

  const [contactsRaw, dealsRaw, companiesRaw] = await Promise.all([
    prisma.contact.findMany({ where: { userId }, select: { id: true, fullNameEnc: true, linkedUserId: true }, orderBy: { createdAt: 'desc' }, take: 400 }),
    prisma.deal.findMany({ where: { userId }, select: { id: true, titleEnc: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 300 }),
    prisma.company.findMany({ where: { userId, id: { not: row.id } }, select: { id: true, nameEnc: true, kind: true }, orderBy: { updatedAt: 'desc' }, take: 300 })
  ]);

  const contactOptions = await contactOptionsForRows(contactsRaw as any);
  const attachedContactIds = new Set(row.contacts.map((link: any) => link.contact.id));
  const dealOptions = dealsRaw.map((deal: any) => ({ id: deal.id, title: safeDecrypt(deal.titleEnc, 'deal.title', 'Untitled deal'), statusLabel: dealStatusLabel(deal.status) }));
  const attachedDealIds = new Set(row.dealLinks.map((link: any) => link.deal.id));
  const companyOptions = companiesRaw.map((company: any) => ({ id: company.id, name: safeDecryptCompany(company.nameEnc, 'company.name', 'Untitled company'), kindLabel: companyKindLabel(company.kind) }));

  return {
    company: {
      id: row.id,
      name: safeDecryptCompany(row.nameEnc, 'company.name', 'Untitled company'),
      website: safeDecryptCompany(row.websiteEnc, 'company.website', ''),
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
    exchangeItems,
    agentArtifacts,
    contactOptions: contactOptions.filter((contact: any) => !attachedContactIds.has(contact.id)),
    allContactOptions: contactOptions,
    dealOptions: dealOptions.filter((deal: any) => !attachedDealIds.has(deal.id)),
    allDealOptions: dealOptions,
    companyOptions,
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
    taskTypes: TASK_TYPES
  };
};

export const actions: Actions = {
  enrichCompany: async ({ params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const company = await ensureCompany(locals.user.id, params.id);
    if (!company) return fail(404, { error: 'Company not found.' });
    const run = await runContactEnrichmentAgent({
      userId: locals.user.id,
      entityType: 'company',
      entityId: params.id,
      enableWebResearch: true,
      enrichmentGoal: 'Find public evidence-backed owner, principal, director, broker, email, phone, LinkedIn, website, and role/title details for this company. Stage details for review before applying to CRM.'
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
    const industry = String(form.get('industry') || '').trim();
    const location = String(form.get('location') || '').trim();
    const description = String(form.get('description') || '').trim();
    const criteria = String(form.get('criteria') || '').trim();
    const notes = String(form.get('notes') || '').trim();

    try {
      await prisma.company.updateMany({
        where: { id: params.id, userId },
        data: {
          nameEnc: encrypt(name, 'company.name'),
          nameIdx: buildIndexToken(name),
          websiteEnc: website ? encrypt(website, 'company.website') : null,
          websiteIdx: website ? buildIndexToken(website) : null,
          industryEnc: industry ? encrypt(industry, 'company.industry') : null,
          locationEnc: location ? encrypt(location, 'company.location') : null,
          descriptionEnc: description ? encrypt(description, 'company.description') : null,
          criteriaEnc: criteria ? encrypt(criteria, 'company.criteria') : null,
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


  createExchangeItem: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const userId = locals.user.id;
    const exists = await ensureCompany(userId, params.id);
    if (!exists) return fail(404, { error: 'Company not found.' });
    try {
      await createExchangeItemFromForm({ userId, form: await request.formData(), links: { companyId: params.id } });
    } catch (err: any) {
      console.error('[companies:createExchangeItem] failed', err);
      return fail(400, { error: err?.message || 'Failed to save want/offer.' });
    }
    throw redirect(303, `/companies/${params.id}`);
  },

  deleteExchangeItem: async ({ request, params, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();
    const exchangeItemId = String(form.get('exchangeItemId') || '').trim();
    if (!exchangeItemId) return fail(400, { error: 'Missing want/offer id.' });
    await deleteExchangeItem({ userId: locals.user.id, id: exchangeItemId, links: { companyId: params.id } });
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
    const title = String(form.get('title') || '').trim();
    if (!title) return fail(400, { error: 'Task title is required.' });
    const dealId = String(form.get('dealId') || '').trim() || null;
    const contactId = String(form.get('contactId') || '').trim() || null;
    const waitingOnContactId = String(form.get('waitingOnContactId') || '').trim() || null;
    const notes = String(form.get('notes') || '').trim();
    const summary = String(form.get('summary') || '').trim();

    await prisma.task.create({
      data: {
        userId,
        companyId: params.id,
        dealId,
        contactId,
        waitingOnContactId,
        titleEnc: encrypt(title, 'task.title'),
        notesEnc: notes ? encrypt(notes, 'task.notes') : null,
        summaryEnc: summary ? encrypt(summary, 'task.summary') : null,
        status: normaliseTaskStatus(form.get('status')) as any,
        urgency: normaliseTaskUrgency(form.get('urgency')) as any,
        importance: normaliseTaskImportance(form.get('importance')) as any,
        taskType: normaliseTaskType(form.get('taskType')) as any,
        dueAt: parseDateTime(form.get('dueAt'))
      }
    });
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
    const criteria = safeDecryptCompany(company.criteriaEnc, 'company.criteria', '');

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

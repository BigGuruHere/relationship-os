// src/lib/server/agents/tools/readEntityContext.ts
// PURPOSE: Read a compact, decrypted Relish entity context for safe agent use.

import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { companyDisplay, companyKindLabel, companyRelationshipTypeLabel, companyStatusLabel, safeDecryptCompany } from '$lib/companies';
import { dealRelationshipLabel, dealStatusLabel, formatDealValue, safeDecrypt } from '$lib/deals';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { loadWants, type WantEntityLink } from '$lib/server/wants';
import { loadOffers } from '$lib/server/offers';
import {
  dealConfidentialityLabel,
  dealContactInterestLabel,
  dealContactStageLabel,
  projectStatusLabel,
  safeDecryptTask,
  taskImportanceLabel,
  taskStatusLabel,
  taskTypeLabel,
  taskUrgencyLabel
} from '$lib/tasks';
import type { AgentEntityType, ToolDefinition } from '$lib/server/agents/types';

type ReadEntityContextInput = {
  entityType: AgentEntityType;
  entityId: string;
};

function decryptContact(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try {
    return decrypt(payload, aad);
  } catch {
    return fallback;
  }
}

function compactText(value: string | null | undefined, max = 1200) {
  const clean = String(value || '').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function wantForAgent(item: any) {
  return {
    id: item.id,
    type: 'WANT',
    wantType: item.wantType,
    title: item.title,
    summary: compactText(item.summary || item.criteria || item.description, 800),
    criteria: compactText(item.criteria, 1000),
    category: item.category,
    geography: item.geography,
    importance: item.importance,
    urgency: item.urgency,
    timeHorizon: item.timeHorizon,
    status: item.status,
    confidence: item.confidence
  };
}

function offerForAgent(item: any) {
  return {
    id: item.id,
    type: 'OFFER',
    offerType: item.offerType,
    direction: item.direction,
    title: item.title,
    summary: compactText(item.summary || item.terms || item.description, 800),
    terms: compactText(item.terms, 1000),
    category: item.category,
    geography: item.geography,
    importance: item.importance,
    urgency: item.urgency,
    timeHorizon: item.timeHorizon,
    status: item.status,
    confidence: item.confidence
  };
}

async function loadFirstClassExchangeContext(userId: string, links: WantEntityLink) {
  // IT: Stage 7.3.1 agents read the new source-of-truth tables, not legacy ExchangeItem rows.
  const [wantRows, offerRows] = await Promise.all([
    loadWants({ userId, links, take: 20 }),
    loadOffers({ userId, links, take: 20 })
  ]);
  const wants = wantRows.map(wantForAgent);
  const offers = offerRows.map(offerForAgent);
  return { wants, offers, wantsOffers: [...wants, ...offers] };
}

async function readContact(userId: string, contactId: string) {
  const row = await prisma.contact.findFirst({
    where: { id: contactId, userId },
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
      phoneEnc: true,
      companyEnc: true,
      positionEnc: true,
      linkedinEnc: true,
      createdAt: true,
      lastContactedAt: true,
      reconnectEveryDays: true,
      linkedUserId: true,
      companyLinks: {
        select: {
          titleEnc: true,
          departmentEnc: true,
          status: true,
          company: { select: { id: true, nameEnc: true, kind: true, status: true } }
        },
        take: 20
      },
      interactions: {
        select: { id: true, channel: true, occurredAt: true, summaryEnc: true, rawTextEnc: true },
        orderBy: { occurredAt: 'desc' },
        take: 8
      },
      dealLinks: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          stage: true,
          interestLevel: true,
          confidentialityStage: true,
          nextActionEnc: true,
          nextFollowUpAt: true,
          deal: { select: { id: true, titleEnc: true, status: true, valueCents: true, currency: true, probability: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      },
      tasks: {
        select: { id: true, titleEnc: true, status: true, urgency: true, importance: true, taskType: true, dueAt: true },
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: 20
      },
    }
  });

  if (!row) throw new Error('Contact not found.');
  const exchange = await loadFirstClassExchangeContext(userId, { contactId });

  return {
    entityType: 'contact',
    id: row.id,
    name: await contactDisplayName(row),
    email: decryptContact(row.emailEnc, 'contact.email', ''),
    phone: decryptContact(row.phoneEnc, 'contact.phone', ''),
    company: decryptContact(row.companyEnc, 'contact.company', ''),
    position: decryptContact(row.positionEnc, 'contact.position', ''),
    linkedin: decryptContact(row.linkedinEnc, 'contact.linkedin', ''),
    createdAt: iso(row.createdAt),
    lastContactedAt: iso(row.lastContactedAt),
    reconnectEveryDays: row.reconnectEveryDays,
    companies: row.companyLinks.map((link: any) => ({
      id: link.company.id,
      name: companyDisplay(link.company),
      kind: companyKindLabel(link.company.kind),
      status: companyStatusLabel(link.company.status),
      title: safeDecryptCompany(link.titleEnc, 'company_contact.title', ''),
      department: safeDecryptCompany(link.departmentEnc, 'company_contact.department', ''),
      employmentStatus: link.status
    })),
    deals: row.dealLinks.map((link: any) => ({
      id: link.deal.id,
      linkId: link.id,
      title: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
      status: dealStatusLabel(link.deal.status),
      value: formatDealValue(link.deal.valueCents, link.deal.currency),
      probability: link.deal.probability,
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextAction: safeDecryptTask(link.nextActionEnc, 'deal_contact.next_action', ''),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    })),
    recentInteractions: row.interactions.map((item: any) => ({
      id: item.id,
      channel: item.channel,
      occurredAt: iso(item.occurredAt),
      summary: compactText(decryptContact(item.summaryEnc, 'interaction.summary', '') || decryptContact(item.rawTextEnc, 'interaction.raw_text', ''), 800)
    })),
    openTasks: row.tasks.map((task: any) => ({
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      status: taskStatusLabel(task.status),
      urgency: taskUrgencyLabel(task.urgency),
      importance: taskImportanceLabel(task.importance),
      type: taskTypeLabel(task.taskType),
      dueAt: iso(task.dueAt)
    })),
    wants: exchange.wants,
    offers: exchange.offers,
    wantsOffers: exchange.wantsOffers
  };
}

async function readDeal(userId: string, dealId: string) {
  const row = await prisma.deal.findFirst({
    where: { id: dealId, userId },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      descriptionSummaryEnc: true,
      status: true,
      valueCents: true,
      currency: true,
      probability: true,
      expectedCloseDate: true,
      contacts: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          stage: true,
          interestLevel: true,
          confidentialityStage: true,
          nextActionEnc: true,
          nextFollowUpAt: true,
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true, emailEnc: true, companyEnc: true, positionEnc: true } }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
        take: 40
      },
      companies: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          stage: true,
          interestLevel: true,
          confidentialityStage: true,
          nextActionEnc: true,
          nextFollowUpAt: true,
          company: { select: { id: true, nameEnc: true, kind: true, status: true, industryEnc: true, locationEnc: true } }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
        take: 40
      },
      notes: {
        select: { id: true, occurredAt: true, channel: true, rawTextEnc: true, summaryEnc: true },
        orderBy: { occurredAt: 'desc' },
        take: 8
      },
      tasks: {
        select: { id: true, titleEnc: true, status: true, urgency: true, importance: true, taskType: true, dueAt: true },
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: 30
      },
    }
  });

  if (!row) throw new Error('Deal not found.');
  const exchange = await loadFirstClassExchangeContext(userId, { dealId });

  return {
    entityType: 'deal',
    id: row.id,
    title: safeDecrypt(row.titleEnc, 'deal.title', 'Untitled deal'),
    description: compactText(safeDecrypt(row.descriptionEnc, 'deal.description', ''), 1600),
    descriptionSummary: safeDecrypt(row.descriptionSummaryEnc, 'deal.description_summary', ''),
    status: dealStatusLabel(row.status),
    value: formatDealValue(row.valueCents, row.currency),
    probability: row.probability,
    expectedCloseDate: iso(row.expectedCloseDate),
    people: await Promise.all(row.contacts.map(async (link: any) => ({
      id: link.contact.id,
      linkId: link.id,
      name: await contactDisplayName(link.contact),
      email: decryptContact(link.contact.emailEnc, 'contact.email', ''),
      company: decryptContact(link.contact.companyEnc, 'contact.company', ''),
      position: decryptContact(link.contact.positionEnc, 'contact.position', ''),
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextAction: safeDecryptTask(link.nextActionEnc, 'deal_contact.next_action', ''),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    }))),
    companies: row.companies.map((link: any) => ({
      id: link.company.id,
      linkId: link.id,
      name: companyDisplay(link.company),
      kind: companyKindLabel(link.company.kind),
      status: companyStatusLabel(link.company.status),
      industry: safeDecryptCompany(link.company.industryEnc, 'company.industry', ''),
      location: safeDecryptCompany(link.company.locationEnc, 'company.location', ''),
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextAction: safeDecryptTask(link.nextActionEnc, 'deal_company.next_action', ''),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    })),
    recentNotes: row.notes.map((note: any) => ({
      id: note.id,
      occurredAt: iso(note.occurredAt),
      channel: note.channel,
      summary: compactText(safeDecrypt(note.summaryEnc, 'deal_note.summary', '') || safeDecrypt(note.rawTextEnc, 'deal_note.raw_text', ''), 800)
    })),
    openTasks: row.tasks.map((task: any) => ({
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      status: taskStatusLabel(task.status),
      urgency: taskUrgencyLabel(task.urgency),
      importance: taskImportanceLabel(task.importance),
      type: taskTypeLabel(task.taskType),
      dueAt: iso(task.dueAt)
    })),
    wants: exchange.wants,
    offers: exchange.offers,
    wantsOffers: exchange.wantsOffers
  };
}

async function readCompany(userId: string, companyId: string) {
  const row = await prisma.company.findFirst({
    where: { id: companyId, userId },
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
      contacts: {
        select: {
          titleEnc: true,
          status: true,
          isPrimary: true,
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true, emailEnc: true, phoneEnc: true } }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
        take: 40
      },
      dealLinks: {
        select: {
          id: true,
          relationshipType: true,
          label: true,
          stage: true,
          interestLevel: true,
          confidentialityStage: true,
          nextActionEnc: true,
          nextFollowUpAt: true,
          deal: { select: { id: true, titleEnc: true, status: true, valueCents: true, currency: true, probability: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 30
      },
      relationshipsAsA: { select: { relationshipType: true, label: true, companyB: { select: { id: true, nameEnc: true, kind: true, status: true } } }, take: 20 },
      relationshipsAsB: { select: { relationshipType: true, label: true, companyA: { select: { id: true, nameEnc: true, kind: true, status: true } } }, take: 20 },
      tasks: {
        select: { id: true, titleEnc: true, status: true, urgency: true, importance: true, taskType: true, dueAt: true },
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] as any } },
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: 30
      },
    }
  });

  if (!row) throw new Error('Company not found.');
  const exchange = await loadFirstClassExchangeContext(userId, { companyId });

  const relationships = [
    ...row.relationshipsAsA.map((r: any) => ({
      companyId: r.companyB.id,
      companyName: companyDisplay(r.companyB),
      relationship: companyRelationshipTypeLabel(r.relationshipType, r.label),
      direction: 'outbound'
    })),
    ...row.relationshipsAsB.map((r: any) => ({
      companyId: r.companyA.id,
      companyName: companyDisplay(r.companyA),
      relationship: companyRelationshipTypeLabel(r.relationshipType, r.label),
      direction: 'inbound'
    }))
  ];

  return {
    entityType: 'company',
    id: row.id,
    name: companyDisplay(row),
    website: safeDecryptCompany(row.websiteEnc, 'company.website', ''),
    phone: safeDecryptCompany(row.phoneEnc, 'company.phone', ''),
    industry: safeDecryptCompany(row.industryEnc, 'company.industry', ''),
    location: safeDecryptCompany(row.locationEnc, 'company.location', ''),
    kind: companyKindLabel(row.kind),
    status: companyStatusLabel(row.status),
    description: compactText(safeDecryptCompany(row.descriptionEnc, 'company.description', ''), 1600),
    criteria: compactText(
      exchange.wants
        .filter((want: any) => want.wantType === 'ACQUISITION_CRITERIA')
        .map((want: any) => want.criteria || want.summary || want.title)
        .filter(Boolean)
        .join('\n\n') || safeDecryptCompany(row.criteriaEnc, 'company.criteria', ''),
      1200
    ),
    notes: compactText(safeDecryptCompany(row.notesEnc, 'company.notes', ''), 1200),
    employees: await Promise.all(row.contacts.map(async (link: any) => ({
      id: link.contact.id,
      name: await contactDisplayName(link.contact),
      email: decryptContact(link.contact.emailEnc, 'contact.email', ''),
      phone: decryptContact(link.contact.phoneEnc, 'contact.phone', ''),
      title: safeDecryptCompany(link.titleEnc, 'company_contact.title', ''),
      status: link.status,
      isPrimary: link.isPrimary
    }))),
    deals: row.dealLinks.map((link: any) => ({
      id: link.deal.id,
      linkId: link.id,
      title: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
      status: dealStatusLabel(link.deal.status),
      value: formatDealValue(link.deal.valueCents, link.deal.currency),
      probability: link.deal.probability,
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextAction: safeDecryptTask(link.nextActionEnc, 'deal_company.next_action', ''),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    })),
    relationships,
    openTasks: row.tasks.map((task: any) => ({
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      status: taskStatusLabel(task.status),
      urgency: taskUrgencyLabel(task.urgency),
      importance: taskImportanceLabel(task.importance),
      type: taskTypeLabel(task.taskType),
      dueAt: iso(task.dueAt)
    })),
    wants: exchange.wants,
    offers: exchange.offers,
    wantsOffers: exchange.wantsOffers
  };
}

async function readProject(userId: string, projectId: string) {
  const row = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      titleEnc: true,
      descriptionEnc: true,
      status: true,
      tasks: {
        select: {
          id: true,
          titleEnc: true,
          status: true,
          urgency: true,
          importance: true,
          taskType: true,
          dueAt: true,
          contact: { select: { id: true, fullNameEnc: true, linkedUserId: true } },
          deal: { select: { id: true, titleEnc: true, status: true } },
          company: { select: { id: true, nameEnc: true, kind: true, status: true } }
        },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
        take: 80
      },
    }
  });

  if (!row) throw new Error('Project not found.');
  const exchange = await loadFirstClassExchangeContext(userId, { projectId });

  const openStatuses = new Set(['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED']);
  const relatedDeals = new Map<string, any>();
  const relatedCompanies = new Map<string, any>();
  const relatedPeople = new Map<string, any>();

  const tasks = await Promise.all(row.tasks.map(async (task: any) => {
    if (task.deal) relatedDeals.set(task.deal.id, { id: task.deal.id, title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal'), status: dealStatusLabel(task.deal.status) });
    if (task.company) relatedCompanies.set(task.company.id, { id: task.company.id, name: companyDisplay(task.company), status: companyStatusLabel(task.company.status) });
    if (task.contact) relatedPeople.set(task.contact.id, { id: task.contact.id, name: await contactDisplayName(task.contact) });
    return {
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      status: taskStatusLabel(task.status),
      urgency: taskUrgencyLabel(task.urgency),
      importance: taskImportanceLabel(task.importance),
      type: taskTypeLabel(task.taskType),
      dueAt: iso(task.dueAt),
      isOpen: openStatuses.has(task.status)
    };
  }));

  return {
    entityType: 'project',
    id: row.id,
    title: safeDecryptTask(row.titleEnc, 'project.title', 'Untitled project'),
    description: compactText(safeDecryptTask(row.descriptionEnc, 'project.description', ''), 1600),
    status: projectStatusLabel(row.status),
    openTasks: tasks.filter((task) => task.isOpen),
    completedTasks: tasks.filter((task) => !task.isOpen),
    relatedDeals: [...relatedDeals.values()],
    relatedCompanies: [...relatedCompanies.values()],
    relatedPeople: [...relatedPeople.values()],
    wants: exchange.wants,
    offers: exchange.offers,
    wantsOffers: exchange.wantsOffers
  };
}

export async function readEntityContext(input: ReadEntityContextInput, userId: string) {
  if (!input.entityId) throw new Error('Missing entity id.');

  switch (input.entityType) {
    case 'contact': return readContact(userId, input.entityId);
    case 'deal': return readDeal(userId, input.entityId);
    case 'company': return readCompany(userId, input.entityId);
    case 'project': return readProject(userId, input.entityId);
    default: throw new Error(`Unsupported entity type: ${(input as any).entityType}`);
  }
}

export const readEntityContextTool: ToolDefinition<ReadEntityContextInput, any> = {
  key: 'read_entity_context',
  description: 'Reads a compact Relish entity context for an agent run.',
  requiresApproval: false,
  execute: async (input, context) => {
    const result = await readEntityContext(input, context.userId);

    // IT: Track which CRM record the run read from.
    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: input.entityType,
        entityId: input.entityId,
        role: 'input'
      }
    });

    return result;
  }
};

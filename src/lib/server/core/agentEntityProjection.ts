// src/lib/server/core/agentEntityProjection.ts
// PURPOSE: Fail-closed, purpose-scoped entity context for existing Relish agents.
// SECURITY: Prisma selects are built from policy before the query. Denied fields are never loaded/decrypted.

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
import type { CoreAccessContext } from '$lib/server/core/accessPolicy';
import type { AgentDataAccessPolicySnapshot, AgentReadableEntityType } from '$lib/server/core/agentDataAccess';
import { assertAgentMayReadEntity } from '$lib/server/core/agentDataAccess';
import { findCoreCompany, findCoreContact, findCoreDeal, findCoreProject } from '$lib/server/core/relationshipRepository';
import {
  buildCompanyEntitySelect,
  buildContactEntitySelect,
  buildDealEntitySelect,
  buildProjectEntitySelect,
  exchangeReadLimits
} from '$lib/server/core/agentEntitySelection';

export type AgentEntityContextInput = {
  entityType: Exclude<AgentReadableEntityType, 'person'>;
  entityId: string;
};

function decryptContact(payload: string | null | undefined, aad: string, fallback = '') {
  if (!payload) return fallback;
  try { return decrypt(payload, aad); } catch { return fallback; }
}

function compactText(value: string | null | undefined, max = 1200) {
  const clean = String(value || '').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}...`;
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

async function loadExchangeContext(
  context: CoreAccessContext,
  policy: AgentDataAccessPolicySnapshot,
  links: WantEntityLink
) {
  const limits = exchangeReadLimits(policy);
  const [wantRows, offerRows] = await Promise.all([
    policy.allowWants ? loadWants({ userId: context.workspaceUserId, links, take: limits.wants }) : Promise.resolve([]),
    policy.allowOffers ? loadOffers({ userId: context.workspaceUserId, links, take: limits.offers }) : Promise.resolve([])
  ]);
  const wants = wantRows.map(wantForAgent);
  const offers = offerRows.map(offerForAgent);
  return { wants, offers, wantsOffers: [...wants, ...offers] };
}

async function readContact(context: CoreAccessContext, policy: AgentDataAccessPolicySnapshot, contactId: string) {
  const row: any = await findCoreContact(context, contactId, buildContactEntitySelect(policy) as any);
  if (!row) throw new Error('Contact not found.');
  const exchange = await loadExchangeContext(context, policy, { contactId });
  const result: Record<string, any> = { entityType: 'contact', id: row.id };

  if (policy.allowIdentity) {
    Object.assign(result, {
      name: await contactDisplayName(row),
      company: decryptContact(row.companyEnc, 'contact.company', ''),
      position: decryptContact(row.positionEnc, 'contact.position', ''),
      createdAt: iso(row.createdAt),
      lastContactedAt: iso(row.lastContactedAt),
      reconnectEveryDays: row.reconnectEveryDays
    });
  }
  if (policy.allowContactMethods) {
    Object.assign(result, {
      email: decryptContact(row.emailEnc, 'contact.email', ''),
      phone: decryptContact(row.phoneEnc, 'contact.phone', ''),
      linkedin: decryptContact(row.linkedinEnc, 'contact.linkedin', '')
    });
  }
  if (row.companyLinks) {
    result.companies = row.companyLinks.map((link: any) => ({
      id: link.company.id,
      ...(policy.allowIdentity ? {
        name: companyDisplay(link.company),
        kind: companyKindLabel(link.company.kind),
        status: companyStatusLabel(link.company.status),
        title: safeDecryptCompany(link.titleEnc, 'company_contact.title', ''),
        department: safeDecryptCompany(link.departmentEnc, 'company_contact.department', '')
      } : {}),
      employmentStatus: link.status
    }));
  }
  if (row.dealLinks) {
    result.deals = row.dealLinks.map((link: any) => ({
      id: link.deal.id,
      linkId: link.id,
      ...(policy.allowIdentity ? {
        title: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
        status: dealStatusLabel(link.deal.status),
        value: formatDealValue(link.deal.valueCents, link.deal.currency),
        probability: link.deal.probability,
        nextAction: safeDecryptTask(link.nextActionEnc, 'deal_contact.next_action', '')
      } : {}),
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    }));
  }
  if (row.interactions) {
    result.recentInteractions = row.interactions.map((item: any) => ({
      id: item.id,
      channel: item.channel,
      occurredAt: iso(item.occurredAt),
      summary: compactText(decryptContact(item.summaryEnc, 'interaction.summary', '') || decryptContact(item.rawTextEnc, 'interaction.raw_text', ''), 800)
    }));
  }
  if (row.tasks) {
    result.openTasks = row.tasks.map((task: any) => ({
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      status: taskStatusLabel(task.status),
      urgency: taskUrgencyLabel(task.urgency),
      importance: taskImportanceLabel(task.importance),
      type: taskTypeLabel(task.taskType),
      dueAt: iso(task.dueAt)
    }));
  }
  if (policy.allowWants) result.wants = exchange.wants;
  if (policy.allowOffers) result.offers = exchange.offers;
  if (policy.allowWants || policy.allowOffers) result.wantsOffers = exchange.wantsOffers;
  return result;
}

async function readDeal(context: CoreAccessContext, policy: AgentDataAccessPolicySnapshot, dealId: string) {
  const row: any = await findCoreDeal(context, dealId, buildDealEntitySelect(policy) as any);
  if (!row) throw new Error('Deal not found.');
  const exchange = await loadExchangeContext(context, policy, { dealId });
  const result: Record<string, any> = { entityType: 'deal', id: row.id };

  if (policy.allowIdentity) {
    Object.assign(result, {
      title: safeDecrypt(row.titleEnc, 'deal.title', 'Untitled deal'),
      description: compactText(safeDecrypt(row.descriptionEnc, 'deal.description', ''), 1600),
      descriptionSummary: safeDecrypt(row.descriptionSummaryEnc, 'deal.description_summary', ''),
      status: dealStatusLabel(row.status),
      value: formatDealValue(row.valueCents, row.currency),
      probability: row.probability,
      expectedCloseDate: iso(row.expectedCloseDate)
    });
  }
  if (row.contacts) {
    result.people = await Promise.all(row.contacts.map(async (link: any) => ({
      id: link.contact.id,
      linkId: link.id,
      ...(policy.allowIdentity ? {
        name: await contactDisplayName(link.contact),
        company: decryptContact(link.contact.companyEnc, 'contact.company', ''),
        position: decryptContact(link.contact.positionEnc, 'contact.position', ''),
        nextAction: safeDecryptTask(link.nextActionEnc, 'deal_contact.next_action', '')
      } : {}),
      ...(policy.allowContactMethods ? {
        email: decryptContact(link.contact.emailEnc, 'contact.email', '')
      } : {}),
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    })));
  }
  if (row.companies) {
    result.companies = row.companies.map((link: any) => ({
      id: link.company.id,
      linkId: link.id,
      ...(policy.allowIdentity ? {
        name: companyDisplay(link.company),
        kind: companyKindLabel(link.company.kind),
        status: companyStatusLabel(link.company.status),
        industry: safeDecryptCompany(link.company.industryEnc, 'company.industry', ''),
        location: safeDecryptCompany(link.company.locationEnc, 'company.location', ''),
        nextAction: safeDecryptTask(link.nextActionEnc, 'deal_company.next_action', '')
      } : {}),
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    }));
  }
  if (row.notes) {
    result.recentNotes = row.notes.map((note: any) => ({
      id: note.id,
      occurredAt: iso(note.occurredAt),
      channel: note.channel,
      summary: compactText(safeDecrypt(note.summaryEnc, 'deal_note.summary', '') || safeDecrypt(note.rawTextEnc, 'deal_note.raw_text', ''), 800)
    }));
  }
  if (row.tasks) {
    result.openTasks = row.tasks.map((task: any) => ({
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      status: taskStatusLabel(task.status),
      urgency: taskUrgencyLabel(task.urgency),
      importance: taskImportanceLabel(task.importance),
      type: taskTypeLabel(task.taskType),
      dueAt: iso(task.dueAt)
    }));
  }
  if (policy.allowWants) result.wants = exchange.wants;
  if (policy.allowOffers) result.offers = exchange.offers;
  if (policy.allowWants || policy.allowOffers) result.wantsOffers = exchange.wantsOffers;
  return result;
}

async function readCompany(context: CoreAccessContext, policy: AgentDataAccessPolicySnapshot, companyId: string) {
  const row: any = await findCoreCompany(context, companyId, buildCompanyEntitySelect(policy) as any);
  if (!row) throw new Error('Company not found.');
  const exchange = await loadExchangeContext(context, policy, { companyId });
  const result: Record<string, any> = { entityType: 'company', id: row.id };

  if (policy.allowIdentity) {
    Object.assign(result, {
      name: companyDisplay(row),
      industry: safeDecryptCompany(row.industryEnc, 'company.industry', ''),
      location: safeDecryptCompany(row.locationEnc, 'company.location', ''),
      kind: companyKindLabel(row.kind),
      status: companyStatusLabel(row.status),
      description: compactText(safeDecryptCompany(row.descriptionEnc, 'company.description', ''), 1600),
      criteria: compactText(
        policy.allowWants && exchange.wants.length
          ? exchange.wants.filter((want: any) => want.wantType === 'ACQUISITION_CRITERIA').map((want: any) => want.criteria || want.summary || want.title).filter(Boolean).join('\n\n')
          : safeDecryptCompany(row.criteriaEnc, 'company.criteria', ''),
        1200
      ),
      notes: compactText(safeDecryptCompany(row.notesEnc, 'company.notes', ''), 1200)
    });
  }
  if (policy.allowContactMethods) {
    Object.assign(result, {
      website: safeDecryptCompany(row.websiteEnc, 'company.website', ''),
      phone: safeDecryptCompany(row.phoneEnc, 'company.phone', '')
    });
  }
  if (row.contacts) {
    result.employees = await Promise.all(row.contacts.map(async (link: any) => ({
      id: link.contact.id,
      ...(policy.allowIdentity ? {
        name: await contactDisplayName(link.contact),
        title: safeDecryptCompany(link.titleEnc, 'company_contact.title', '')
      } : {}),
      ...(policy.allowContactMethods ? {
        email: decryptContact(link.contact.emailEnc, 'contact.email', ''),
        phone: decryptContact(link.contact.phoneEnc, 'contact.phone', '')
      } : {}),
      status: link.status,
      isPrimary: link.isPrimary
    })));
  }
  if (row.dealLinks) {
    result.deals = row.dealLinks.map((link: any) => ({
      id: link.deal.id,
      linkId: link.id,
      ...(policy.allowIdentity ? {
        title: safeDecrypt(link.deal.titleEnc, 'deal.title', 'Untitled deal'),
        status: dealStatusLabel(link.deal.status),
        value: formatDealValue(link.deal.valueCents, link.deal.currency),
        probability: link.deal.probability,
        nextAction: safeDecryptTask(link.nextActionEnc, 'deal_company.next_action', '')
      } : {}),
      role: dealRelationshipLabel(link.relationshipType, link.label),
      stage: dealContactStageLabel(link.stage),
      interest: dealContactInterestLabel(link.interestLevel),
      confidentiality: dealConfidentialityLabel(link.confidentialityStage),
      nextFollowUpAt: iso(link.nextFollowUpAt)
    }));
  }
  if (row.relationshipsAsA || row.relationshipsAsB) {
    result.relationships = [
      ...(row.relationshipsAsA || []).map((r: any) => ({
        companyId: r.companyB.id,
        ...(policy.allowIdentity ? { companyName: companyDisplay(r.companyB) } : {}),
        relationship: companyRelationshipTypeLabel(r.relationshipType, r.label),
        direction: 'outbound'
      })),
      ...(row.relationshipsAsB || []).map((r: any) => ({
        companyId: r.companyA.id,
        ...(policy.allowIdentity ? { companyName: companyDisplay(r.companyA) } : {}),
        relationship: companyRelationshipTypeLabel(r.relationshipType, r.label),
        direction: 'inbound'
      }))
    ];
  }
  if (row.tasks) {
    result.openTasks = row.tasks.map((task: any) => ({
      id: task.id,
      title: safeDecryptTask(task.titleEnc, 'task.title', 'Untitled task'),
      status: taskStatusLabel(task.status),
      urgency: taskUrgencyLabel(task.urgency),
      importance: taskImportanceLabel(task.importance),
      type: taskTypeLabel(task.taskType),
      dueAt: iso(task.dueAt)
    }));
  }
  if (policy.allowWants) result.wants = exchange.wants;
  if (policy.allowOffers) result.offers = exchange.offers;
  if (policy.allowWants || policy.allowOffers) result.wantsOffers = exchange.wantsOffers;
  return result;
}

async function readProject(context: CoreAccessContext, policy: AgentDataAccessPolicySnapshot, projectId: string) {
  const row: any = await findCoreProject(context, projectId, buildProjectEntitySelect(policy) as any);
  if (!row) throw new Error('Project not found.');
  const exchange = await loadExchangeContext(context, policy, { projectId });
  const result: Record<string, any> = { entityType: 'project', id: row.id };

  if (policy.allowIdentity) {
    Object.assign(result, {
      title: safeDecryptTask(row.titleEnc, 'project.title', 'Untitled project'),
      description: compactText(safeDecryptTask(row.descriptionEnc, 'project.description', ''), 1600),
      status: projectStatusLabel(row.status)
    });
  }

  if (row.tasks) {
    const openStatuses = new Set(['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED']);
    const relatedDeals = new Map<string, any>();
    const relatedCompanies = new Map<string, any>();
    const relatedPeople = new Map<string, any>();
    const tasks = await Promise.all(row.tasks.map(async (task: any) => {
      if (task.deal) relatedDeals.set(task.deal.id, { id: task.deal.id, ...(policy.allowIdentity ? { title: safeDecrypt(task.deal.titleEnc, 'deal.title', 'Untitled deal'), status: dealStatusLabel(task.deal.status) } : {}) });
      if (task.company) relatedCompanies.set(task.company.id, { id: task.company.id, ...(policy.allowIdentity ? { name: companyDisplay(task.company), status: companyStatusLabel(task.company.status) } : {}) });
      if (task.contact) relatedPeople.set(task.contact.id, { id: task.contact.id, ...(policy.allowIdentity ? { name: await contactDisplayName(task.contact) } : {}) });
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
    result.openTasks = tasks.filter((task) => task.isOpen);
    result.completedTasks = tasks.filter((task) => !task.isOpen);
    if (policy.allowRelationships && policy.allowDeals) result.relatedDeals = [...relatedDeals.values()];
    if (policy.allowRelationships && policy.allowCompanies) result.relatedCompanies = [...relatedCompanies.values()];
    if (policy.allowRelationships && policy.allowContacts) result.relatedPeople = [...relatedPeople.values()];
  }

  if (policy.allowWants) result.wants = exchange.wants;
  if (policy.allowOffers) result.offers = exchange.offers;
  if (policy.allowWants || policy.allowOffers) result.wantsOffers = exchange.wantsOffers;
  return result;
}

export async function buildAgentEntityContextProjection(params: {
  context: CoreAccessContext;
  policy: AgentDataAccessPolicySnapshot;
  input: AgentEntityContextInput;
}) {
  const { context, policy, input } = params;
  if (!input.entityId) throw new Error('Missing entity id.');
  assertAgentMayReadEntity(policy, input.entityType);

  switch (input.entityType) {
    case 'contact': return readContact(context, policy, input.entityId);
    case 'company': return readCompany(context, policy, input.entityId);
    case 'deal': return readDeal(context, policy, input.entityId);
    case 'project': return readProject(context, policy, input.entityId);
  }
}

// src/lib/server/core/agentEntitySelection.ts
// PURPOSE: Pure policy-to-select builders for fail-closed agent entity reads.
// SECURITY: Denied fields/relations are absent from the Prisma select, so they are never queried or decrypted.

export type AgentEntityReadPolicy = {
  allowContacts: boolean;
  allowCompanies: boolean;
  allowDeals: boolean;
  allowProjects: boolean;
  allowIdentity: boolean;
  allowContactMethods: boolean;
  allowInteractions: boolean;
  allowWants: boolean;
  allowOffers: boolean;
  allowRelationships: boolean;
  allowTasks: boolean;
  maxRecentInteractions: number;
  maxWants: number;
  maxOffers: number;
};

function clamp(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.round(value)));
}

export function exchangeReadLimits(policy: AgentEntityReadPolicy) {
  return {
    wants: clamp(policy.maxWants, 8, 30),
    offers: clamp(policy.maxOffers, 8, 30)
  };
}

function contactNameSelect(policy: AgentEntityReadPolicy) {
  const select: Record<string, unknown> = { id: true };
  if (policy.allowIdentity) Object.assign(select, { fullNameEnc: true, linkedUserId: true });
  return select;
}

function contactForDealSelect(policy: AgentEntityReadPolicy) {
  const select = contactNameSelect(policy);
  if (policy.allowIdentity) Object.assign(select, { companyEnc: true, positionEnc: true });
  if (policy.allowContactMethods) Object.assign(select, { emailEnc: true });
  return select;
}

function contactForCompanyEmployeeSelect(policy: AgentEntityReadPolicy) {
  const select = contactNameSelect(policy);
  if (policy.allowContactMethods) Object.assign(select, { emailEnc: true, phoneEnc: true });
  return select;
}

function companyBasicSelect(policy: AgentEntityReadPolicy) {
  const select: Record<string, unknown> = { id: true };
  if (policy.allowIdentity) Object.assign(select, { nameEnc: true, kind: true, status: true });
  return select;
}

function companyForDealSelect(policy: AgentEntityReadPolicy) {
  const select = companyBasicSelect(policy);
  if (policy.allowIdentity) Object.assign(select, { industryEnc: true, locationEnc: true });
  return select;
}

function dealBasicSelect(policy: AgentEntityReadPolicy) {
  const select: Record<string, unknown> = { id: true };
  if (policy.allowIdentity) Object.assign(select, { titleEnc: true, status: true });
  return select;
}

function dealCommercialSelect(policy: AgentEntityReadPolicy) {
  const select = dealBasicSelect(policy);
  if (policy.allowIdentity) Object.assign(select, { valueCents: true, currency: true, probability: true });
  return select;
}

function dealIdentitySelect(policy: AgentEntityReadPolicy) {
  const select = dealCommercialSelect(policy);
  if (policy.allowIdentity) Object.assign(select, {
    descriptionEnc: true,
    descriptionSummaryEnc: true,
    expectedCloseDate: true
  });
  return select;
}

export function buildContactEntitySelect(policy: AgentEntityReadPolicy) {
  const select: Record<string, any> = { id: true };
  if (policy.allowIdentity) Object.assign(select, {
    fullNameEnc: true,
    companyEnc: true,
    positionEnc: true,
    linkedUserId: true,
    createdAt: true,
    lastContactedAt: true,
    reconnectEveryDays: true
  });
  if (policy.allowContactMethods) Object.assign(select, { emailEnc: true, phoneEnc: true, linkedinEnc: true });

  if (policy.allowRelationships && policy.allowCompanies) {
    select.companyLinks = {
      select: {
        status: true,
        ...(policy.allowIdentity ? { titleEnc: true, departmentEnc: true } : {}),
        company: { select: companyBasicSelect(policy) }
      },
      take: 20
    };
  }

  if (policy.allowRelationships && policy.allowDeals) {
    select.dealLinks = {
      select: {
        id: true,
        relationshipType: true,
        label: true,
        stage: true,
        interestLevel: true,
        confidentialityStage: true,
        ...(policy.allowIdentity ? { nextActionEnc: true } : {}),
        nextFollowUpAt: true,
        deal: { select: dealCommercialSelect(policy) }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    };
  }

  if (policy.allowInteractions) {
    select.interactions = {
      select: { id: true, channel: true, occurredAt: true, summaryEnc: true, rawTextEnc: true },
      orderBy: { occurredAt: 'desc' },
      take: clamp(policy.maxRecentInteractions, 8, 30)
    };
  }

  if (policy.allowTasks) {
    select.tasks = {
      select: { id: true, titleEnc: true, status: true, urgency: true, importance: true, taskType: true, dueAt: true },
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] } },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 20
    };
  }

  return select;
}

export function buildDealEntitySelect(policy: AgentEntityReadPolicy) {
  const select: Record<string, any> = { id: true };
  if (policy.allowIdentity) Object.assign(select, dealIdentitySelect(policy));

  if (policy.allowRelationships && policy.allowContacts) {
    select.contacts = {
      select: {
        id: true,
        relationshipType: true,
        label: true,
        stage: true,
        interestLevel: true,
        confidentialityStage: true,
        ...(policy.allowIdentity ? { nextActionEnc: true } : {}),
        nextFollowUpAt: true,
        contact: { select: contactForDealSelect(policy) }
      },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      take: 40
    };
  }

  if (policy.allowRelationships && policy.allowCompanies) {
    select.companies = {
      select: {
        id: true,
        relationshipType: true,
        label: true,
        stage: true,
        interestLevel: true,
        confidentialityStage: true,
        ...(policy.allowIdentity ? { nextActionEnc: true } : {}),
        nextFollowUpAt: true,
        company: { select: companyForDealSelect(policy) }
      },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      take: 40
    };
  }

  if (policy.allowInteractions) {
    select.notes = {
      select: { id: true, occurredAt: true, channel: true, rawTextEnc: true, summaryEnc: true },
      orderBy: { occurredAt: 'desc' },
      take: clamp(policy.maxRecentInteractions, 8, 30)
    };
  }

  if (policy.allowTasks) {
    select.tasks = {
      select: { id: true, titleEnc: true, status: true, urgency: true, importance: true, taskType: true, dueAt: true },
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] } },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 30
    };
  }

  return select;
}

export function buildCompanyEntitySelect(policy: AgentEntityReadPolicy) {
  const select: Record<string, any> = { id: true };
  if (policy.allowIdentity) Object.assign(select, {
    nameEnc: true,
    industryEnc: true,
    locationEnc: true,
    descriptionEnc: true,
    criteriaEnc: true,
    notesEnc: true,
    kind: true,
    status: true
  });
  if (policy.allowContactMethods) Object.assign(select, { websiteEnc: true, phoneEnc: true });

  if (policy.allowRelationships && policy.allowContacts) {
    select.contacts = {
      select: {
        status: true,
        isPrimary: true,
        ...(policy.allowIdentity ? { titleEnc: true } : {}),
        contact: { select: contactForCompanyEmployeeSelect(policy) }
      },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      take: 40
    };
  }

  if (policy.allowRelationships && policy.allowDeals) {
    select.dealLinks = {
      select: {
        id: true,
        relationshipType: true,
        label: true,
        stage: true,
        interestLevel: true,
        confidentialityStage: true,
        ...(policy.allowIdentity ? { nextActionEnc: true } : {}),
        nextFollowUpAt: true,
        deal: { select: dealCommercialSelect(policy) }
      },
      orderBy: { updatedAt: 'desc' },
      take: 30
    };
  }

  if (policy.allowRelationships && policy.allowCompanies) {
    const relatedCompany = { select: companyBasicSelect(policy) };
    select.relationshipsAsA = {
      select: { relationshipType: true, label: true, companyB: relatedCompany },
      take: 20
    };
    select.relationshipsAsB = {
      select: { relationshipType: true, label: true, companyA: relatedCompany },
      take: 20
    };
  }

  if (policy.allowTasks) {
    select.tasks = {
      select: { id: true, titleEnc: true, status: true, urgency: true, importance: true, taskType: true, dueAt: true },
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING', 'SNOOZED'] } },
      orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 30
    };
  }

  return select;
}

export function buildProjectEntitySelect(policy: AgentEntityReadPolicy) {
  const select: Record<string, any> = { id: true };
  if (policy.allowIdentity) Object.assign(select, { titleEnc: true, descriptionEnc: true, status: true });

  if (policy.allowTasks) {
    const taskSelect: Record<string, any> = {
      id: true,
      titleEnc: true,
      status: true,
      urgency: true,
      importance: true,
      taskType: true,
      dueAt: true
    };
    if (policy.allowRelationships && policy.allowContacts) taskSelect.contact = { select: contactNameSelect(policy) };
    if (policy.allowRelationships && policy.allowDeals) taskSelect.deal = { select: dealBasicSelect(policy) };
    if (policy.allowRelationships && policy.allowCompanies) taskSelect.company = { select: companyBasicSelect(policy) };

    select.tasks = {
      select: taskSelect,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { updatedAt: 'desc' }],
      take: 80
    };
  }

  return select;
}
